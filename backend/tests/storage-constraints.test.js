import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import {
  resetStorageConstraintsDependencies,
  setStorageConstraintsDependencies,
} from '../src/services/storage-constraints.service.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';

const developmentBucket = {
  file_size_limit: 10_485_760,
  allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
};

function mockIdentity() {
  setAuthDependencies({
    verifyAccessToken: async (token) => {
      if (token === 'customer-token') {
        return { userId: customerId, email: 'customer@example.com', fullName: 'Customer' };
      }
      if (token === 'admin-token') {
        return { userId: adminId, email: 'admin@example.com', fullName: 'Admin' };
      }
      throw new ApiError(401, 'Invalid or expired access token');
    },
    provisionIdentity: async () => {},
    loadProfileWithRoles: async (userId) => ({
      profile: { id: userId, fullName: userId === adminId ? 'Admin' : 'Customer' },
      roles: userId === adminId ? ['customer', 'admin'] : ['customer'],
    }),
  });
}

afterEach(() => {
  resetAuthDependencies();
  resetStorageConstraintsDependencies();
});

after(async () => {
  await stopTestServer();
});

test('GET /api/v1/admin/storage/artwork-images rejects anonymous callers', async () => {
  const response = await api('/api/v1/admin/storage/artwork-images');
  assert.equal(response.status, 401);
});

test('GET /api/v1/admin/storage/artwork-images rejects customers', async () => {
  mockIdentity();
  const response = await api('/api/v1/admin/storage/artwork-images', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(response.status, 403);
});

test('GET /api/v1/admin/storage/artwork-images returns bucket limits for admins', async () => {
  mockIdentity();
  setStorageConstraintsDependencies({
    loadArtworkImagesBucket: async () => developmentBucket,
  });
  const response = await api('/api/v1/admin/storage/artwork-images', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.bucket, 'artwork-images');
  assert.equal(response.json.data.fileSizeLimitBytes, 10_485_760);
  assert.deepEqual(response.json.data.allowedMimeTypes, [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ]);
  assert.equal('owner' in response.json.data, false);
  assert.equal('owner_id' in response.json.data, false);
  assert.equal('public' in response.json.data, false);
});

test('GET /api/v1/admin/storage/artwork-images returns 404 when the bucket row is absent', async () => {
  mockIdentity();
  setStorageConstraintsDependencies({
    loadArtworkImagesBucket: async () => null,
  });
  const response = await api('/api/v1/admin/storage/artwork-images', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(response.status, 404);
  assert.match(response.json?.error?.message || '', /was not found/i);
});

test('GET /api/v1/admin/storage/artwork-images returns 503 when the metadata query fails', async () => {
  mockIdentity();
  setStorageConstraintsDependencies({
    loadArtworkImagesBucket: async () => {
      const error = new Error('permission denied for schema storage');
      error.code = '42501';
      throw error;
    },
  });
  const response = await api('/api/v1/admin/storage/artwork-images', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(response.status, 503);
  assert.equal(response.json?.error?.message, 'Artwork-images bucket constraints are unavailable.');
  assert.doesNotMatch(JSON.stringify(response.json), /42501|permission denied|storage\.buckets/i);
});

test('GET /api/v1/admin/storage/artwork-images reads the live development bucket when reachable', async (t) => {
  mockIdentity();
  const response = await api('/api/v1/admin/storage/artwork-images', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  if (response.status === 503 || response.status === 404) {
    t.skip('artwork-images bucket metadata is not readable until 0013 is applied');
    return;
  }
  assert.equal(response.status, 200);
  assert.equal(response.json.data.bucket, 'artwork-images');
  assert.equal(response.json.data.fileSizeLimitBytes, 10_485_760);
  assert.deepEqual(response.json.data.allowedMimeTypes, [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ]);
  assert.equal('owner' in response.json.data, false);
  assert.equal('owner_id' in response.json.data, false);
});

test('Express reads artwork-images limits through the 0013 function, not storage.buckets', () => {
  const migrationsDir = path.join(backendRoot, 'src/db/migrations');
  const sql = fs.readFileSync(
    path.join(migrationsDir, '0013_artwork_images_bucket_constraints.sql'),
    'utf8',
  );
  const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta/0013_snapshot.json'), 'utf8'));
  const previous = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta/0012_snapshot.json'), 'utf8'));
  const service = fs.readFileSync(
    path.join(backendRoot, 'src/services/storage-constraints.service.js'),
    'utf8',
  );

  const entry = journal.entries.find((item) => item.tag === '0013_artwork_images_bucket_constraints');
  assert.equal(entry?.idx, 13);
  assert.equal(journal.entries.at(-1)?.tag, '0013_artwork_images_bucket_constraints');
  assert.equal(snapshot.prevId, previous.id);

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.artwork_images_bucket_constraints\(\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = pg_catalog, storage/);
  assert.match(sql, /RETURNS TABLE \(\s*id text,\s*file_size_limit bigint,\s*allowed_mime_types text\[\]/s);
  assert.match(sql, /WHERE b\.id = 'artwork-images'/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.artwork_images_bucket_constraints\(\) TO maison_app/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.artwork_images_bucket_constraints\(\) FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.doesNotMatch(sql, /^GRANT USAGE ON SCHEMA storage/im);
  assert.doesNotMatch(sql, /^GRANT SELECT ON (TABLE )?storage\.(buckets|objects)/im);
  assert.doesNotMatch(sql, /^GRANT SELECT ON ALL TABLES IN SCHEMA storage/im);
  assert.doesNotMatch(sql, /^GRANT EXECUTE ON FUNCTION public\.artwork_images_bucket_constraints\(\) TO authenticated/m);
  assert.doesNotMatch(sql, /^GRANT EXECUTE ON FUNCTION public\.artwork_images_bucket_constraints\(\) TO service_role/m);
  assert.doesNotMatch(sql, /BYPASSRLS|ALTER ROLE maison_app/);
  assert.doesNotMatch(sql, /owner_id|avif_autodetection/);

  assert.match(service, /FROM public\.artwork_images_bucket_constraints\(\)/);
  assert.doesNotMatch(service, /FROM storage\.buckets/);
  assert.match(service, /operation: 'artwork_images_bucket_constraints'/);
  assert.match(service, /sqlState: error\?\.code/);
  assert.match(service, /toSafeErrorLog\(error\)/);
});
