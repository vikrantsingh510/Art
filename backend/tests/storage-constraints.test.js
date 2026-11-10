import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import {
  resetStorageConstraintsDependencies,
  setStorageConstraintsDependencies,
} from '../src/services/storage-constraints.service.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

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
});

test('GET /api/v1/admin/storage/artwork-images reads the live development bucket when reachable', async (t) => {
  mockIdentity();
  const response = await api('/api/v1/admin/storage/artwork-images', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  if (response.status === 503 || response.status === 404) {
    t.skip('artwork-images bucket metadata is not readable from this environment');
    return;
  }
  assert.equal(response.status, 200);
  assert.equal(response.json.data.bucket, 'artwork-images');
  assert.equal(typeof response.json.data.fileSizeLimitBytes === 'number'
    || response.json.data.fileSizeLimitBytes === null, true);
  assert.equal(Array.isArray(response.json.data.allowedMimeTypes)
    || response.json.data.allowedMimeTypes === null, true);
  assert.equal('owner' in response.json.data, false);
  assert.equal('owner_id' in response.json.data, false);
});
