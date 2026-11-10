import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import {
  MAX_ARTWORK_IMAGES,
  assertCanPublish,
  assertImageCapacity,
  assertImageFileAgainstConstraints,
  assertPrimaryBelongsToArtwork,
  assertReorderPayload,
  assertStoragePathForArtwork,
  nextDisplayOrder,
  replacementPrimaryId,
} from '../src/lib/artwork-images.js';
import { artworkCreateBody, artworkImageBody, artworkImageReorderBody } from '../src/validators/artwork.validators.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import {
  resetStorageConstraintsDependencies,
  setStorageConstraintsDependencies,
} from '../src/services/storage-constraints.service.js';
import { client } from '../src/config/database.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const artworkId = '33333333-3333-4333-8333-333333333333';
const imageA = '44444444-4444-4444-8444-444444444444';
const imageB = '55555555-5555-4555-8555-555555555555';
const imageC = '66666666-6666-4666-8666-666666666666';
const foreignImage = '77777777-7777-4777-8777-777777777777';

const bucketConstraints = {
  bucket: 'artwork-images',
  fileSizeLimitBytes: 10_485_760,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
};

function mockIdentity(actorAdminId = adminId) {
  setAuthDependencies({
    verifyAccessToken: async (token) => {
      if (token === 'customer-token') {
        return { userId: customerId, email: 'customer@example.com', fullName: 'Customer' };
      }
      if (token === 'admin-token') {
        return { userId: actorAdminId, email: 'admin@example.com', fullName: 'Admin' };
      }
      throw new ApiError(401, 'Invalid or expired access token');
    },
    provisionIdentity: async () => {},
    loadProfileWithRoles: async (userId) => ({
      profile: { id: userId, fullName: userId === actorAdminId ? 'Admin' : 'Customer' },
      roles: userId === actorAdminId ? ['customer', 'admin'] : ['customer'],
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

test('capacity helper allows five images and rejects a sixth', () => {
  assert.equal(MAX_ARTWORK_IMAGES, 5);
  assert.doesNotThrow(() => assertImageCapacity(0, 1));
  assert.doesNotThrow(() => assertImageCapacity(4, 1));
  assert.throws(() => assertImageCapacity(5, 1), (error) => error.statusCode === 400);
  assert.throws(() => assertImageCapacity(4, 2), (error) => error.statusCode === 400);
});

test('display order appends after the current maximum', () => {
  assert.equal(nextDisplayOrder([]), 0);
  assert.equal(nextDisplayOrder([{ displayOrder: 0 }, { displayOrder: 3 }]), 4);
});

test('removing the primary image selects the next remaining image', () => {
  const images = [
    { id: imageA, displayOrder: 0, isPrimary: true },
    { id: imageB, displayOrder: 1, isPrimary: false },
    { id: imageC, displayOrder: 2, isPrimary: false },
  ];
  assert.equal(replacementPrimaryId(images, imageA), imageB);
  assert.equal(replacementPrimaryId(images, imageB), imageA);
  assert.equal(replacementPrimaryId([{ id: imageA, displayOrder: 0, isPrimary: true }], imageA), null);
});

test('published artworks require at least one image', () => {
  assert.doesNotThrow(() => assertCanPublish('draft', 0));
  assert.doesNotThrow(() => assertCanPublish('published', 1));
  assert.throws(() => assertCanPublish('published', 0), (error) => error.statusCode === 400);
});

test('create-as-published is rejected by the artwork create schema path helper', () => {
  assert.throws(() => assertCanPublish('published', 0));
  const parsed = artworkCreateBody.safeParse({
    title: 'Lot',
    artistName: 'Artist',
    pricePaise: 1000,
    status: 'published',
  });
  assert.equal(parsed.success, true);
});

test('storage paths must stay under the artwork id', () => {
  assert.doesNotThrow(() => assertStoragePathForArtwork(artworkId, `${artworkId}/file.jpg`));
  assert.throws(
    () => assertStoragePathForArtwork(artworkId, `${foreignImage}/file.jpg`),
    (error) => error.statusCode === 400,
  );
});

test('reorder payload rejects duplicates, missing ids and foreign ids', () => {
  const existing = [imageA, imageB];
  assert.doesNotThrow(() => assertReorderPayload(existing, [imageB, imageA]));
  assert.throws(() => assertReorderPayload(existing, [imageA, imageA]), (error) => error.statusCode === 400);
  assert.throws(() => assertReorderPayload(existing, [imageA]), (error) => error.statusCode === 400);
  assert.throws(
    () => assertReorderPayload(existing, [imageA, foreignImage]),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertPrimaryBelongsToArtwork(existing, foreignImage),
    (error) => error.statusCode === 400,
  );
});

test('missing bucket constraints fail closed instead of skipping validation', () => {
  assert.throws(
    () => assertImageFileAgainstConstraints({ mimeType: 'image/jpeg', fileSizeBytes: 1000 }, null),
    (error) => error.statusCode === 503,
  );
  assert.throws(
    () => assertImageFileAgainstConstraints({ mimeType: 'image/jpeg', fileSizeBytes: 1000 }),
    (error) => error.statusCode === 503,
  );
});

test('bucket constraints reject unsupported MIME types and oversized files', () => {
  assert.doesNotThrow(() => assertImageFileAgainstConstraints({
    mimeType: 'image/jpeg',
    fileSizeBytes: 1000,
  }, bucketConstraints));
  assert.throws(
    () => assertImageFileAgainstConstraints({ mimeType: 'image/gif', fileSizeBytes: 1000 }, bucketConstraints),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertImageFileAgainstConstraints({ mimeType: 'image/jpeg', fileSizeBytes: 10_485_761 }, bucketConstraints),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertImageFileAgainstConstraints({ mimeType: 'image/jpeg' }, bucketConstraints),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertImageFileAgainstConstraints({ fileSizeBytes: 1000 }, bucketConstraints),
    (error) => error.statusCode === 400,
  );
});

test('image register body accepts MIME and size metadata', () => {
  const parsed = artworkImageBody.safeParse({
    storagePath: `${artworkId}/file.jpg`,
    mimeType: 'image/jpeg',
    fileSizeBytes: 2048,
    isPrimary: true,
  });
  assert.equal(parsed.success, true);
});

test('reorder body rejects more than five ids', () => {
  const parsed = artworkImageReorderBody.safeParse({
    imageIds: [imageA, imageB, imageC, foreignImage, artworkId, adminId],
  });
  assert.equal(parsed.success, false);
});

test('non-admins cannot register, reorder or remove artwork images', async () => {
  mockIdentity();
  const headers = { Authorization: 'Bearer customer-token' };
  const register = await api(`/api/v1/admin/artworks/${artworkId}/images`, {
    method: 'POST',
    headers,
    body: { storagePath: `${artworkId}/file.jpg`, mimeType: 'image/jpeg', fileSizeBytes: 12 },
  });
  const reorder = await api(`/api/v1/admin/artworks/${artworkId}/images/order`, {
    method: 'PATCH',
    headers,
    body: { imageIds: [imageA] },
  });
  const remove = await api(`/api/v1/admin/artworks/${artworkId}/images/${imageA}`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(register.status, 403);
  assert.equal(reorder.status, 403);
  assert.equal(remove.status, 403);
});

test('anonymous callers cannot mutate artwork images', async () => {
  const register = await api(`/api/v1/admin/artworks/${artworkId}/images`, {
    method: 'POST',
    body: { storagePath: `${artworkId}/file.jpg` },
  });
  const remove = await api(`/api/v1/admin/artworks/${artworkId}/images/${imageA}`, {
    method: 'DELETE',
  });
  assert.equal(register.status, 401);
  assert.equal(remove.status, 401);
});

test('admins receive validation errors for invalid image reorder payloads', async () => {
  mockIdentity();
  const response = await api(`/api/v1/admin/artworks/${artworkId}/images/order`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer admin-token' },
    body: { imageIds: ['not-a-uuid'] },
  });
  assert.equal(response.status, 400);
});

test('image register fails closed when artwork-images bucket constraints are unavailable', async () => {
  mockIdentity();
  setStorageConstraintsDependencies({
    loadArtworkImagesBucket: async () => {
      throw new Error('storage.buckets is unreachable');
    },
  });
  const response = await api(`/api/v1/admin/artworks/${artworkId}/images`, {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token' },
    body: {
      storagePath: `${artworkId}/file.jpg`,
      mimeType: 'image/jpeg',
      fileSizeBytes: 2048,
    },
  });
  assert.equal(response.status, 503);
  assert.match(response.json?.error?.message || '', /unavailable/i);
});

test('image register fails closed when the artwork-images bucket is missing', async () => {
  mockIdentity();
  setStorageConstraintsDependencies({
    loadArtworkImagesBucket: async () => null,
  });
  const response = await api(`/api/v1/admin/artworks/${artworkId}/images`, {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token' },
    body: {
      storagePath: `${artworkId}/file.jpg`,
      mimeType: 'image/jpeg',
      fileSizeBytes: 2048,
    },
  });
  assert.equal(response.status, 404);
});

test('image register still rejects disallowed MIME types when bucket limits load', async () => {
  mockIdentity();
  setStorageConstraintsDependencies({
    loadArtworkImagesBucket: async () => ({
      id: 'artwork-images',
      file_size_limit: 10_485_760,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    }),
  });
  const response = await api(`/api/v1/admin/artworks/${artworkId}/images`, {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token' },
    body: {
      storagePath: `${artworkId}/file.jpg`,
      mimeType: 'image/gif',
      fileSizeBytes: 2048,
    },
  });
  assert.equal(response.status, 400);
});

test('valid JPEG register continues past live bucket checks', async () => {
  mockIdentity();
  setStorageConstraintsDependencies({
    loadArtworkImagesBucket: async () => ({
      id: 'artwork-images',
      file_size_limit: 10_485_760,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    }),
  });
  const response = await api(`/api/v1/admin/artworks/${artworkId}/images`, {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token' },
    body: {
      storagePath: `${artworkId}/file.jpg`,
      mimeType: 'image/jpeg',
      fileSizeBytes: 2048,
    },
  });
  assert.notEqual(response.status, 503);
  assert.notEqual(response.status, 400);
  assert.equal(response.status, 404);
});

test('admin can register a valid JPEG on a created draft artwork', async (t) => {
  setStorageConstraintsDependencies({
    loadArtworkImagesBucket: async () => ({
      id: 'artwork-images',
      file_size_limit: 10_485_760,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    }),
  });
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    t.skip('database is not reachable from this environment');
    return;
  }

  const [adminRow] = await client`
    SELECT user_id
    FROM public.user_roles
    WHERE role = 'admin'
    LIMIT 1
  `;
  if (!adminRow?.user_id) {
    t.skip('no admin profile exists in this database');
    return;
  }
  mockIdentity(adminRow.user_id);

  const stamp = Date.now();
  const created = await api('/api/v1/admin/artworks', {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token' },
    body: {
      title: `JPEG register verification ${stamp}`,
      slug: `jpeg-register-verification-${stamp}`,
      artistName: 'Verification Atelier',
      pricePaise: 1000,
      status: 'draft',
    },
  });
  assert.equal(created.status, 201, created.json?.error?.message || 'artwork create failed');
  const lotId = created.json.data.id;
  const storagePath = `${lotId}/verification.jpg`;
  let imageId;

  try {
    const registered = await api(`/api/v1/admin/artworks/${lotId}/images`, {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        storagePath,
        altText: 'Verification JPEG',
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048,
        isPrimary: true,
      },
    });
    assert.equal(registered.status, 201, registered.json?.error?.message || 'image register failed');
    assert.equal(registered.json.data.artworkId, lotId);
    assert.equal(registered.json.data.storagePath, storagePath);
    assert.equal(registered.json.data.isPrimary, true);
    assert.equal(registered.json.data.displayOrder, 0);
    imageId = registered.json.data.id;
  } finally {
    if (imageId) {
      await api(`/api/v1/admin/artworks/${lotId}/images/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer admin-token' },
      });
    }
    await api(`/api/v1/admin/artworks/${lotId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    });
  }
});
