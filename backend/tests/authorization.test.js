import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { artworkMediaBody } from '../src/validators/artwork.validators.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('customers cannot create artworks', async () => {
  setAuthDependencies({
    verifyAccessToken: async () => ({
      userId: customerId,
      email: 'customer@example.com',
      fullName: 'Customer',
    }),
    provisionIdentity: async () => {},
    loadProfileWithRoles: async () => ({
      profile: { id: customerId, fullName: 'Customer' },
      roles: ['customer'],
    }),
  });

  const response = await api('/api/v1/admin/artworks', {
    method: 'POST',
    headers: { Authorization: 'Bearer customer-token' },
    body: {
      title: 'Forbidden',
      artistName: 'Artist',
      pricePaise: 1000,
    },
  });
  assert.equal(response.status, 403);
});

test('certificates cannot be stored as public media', () => {
  const result = artworkMediaBody.safeParse({
    mediaType: 'certificate',
    storageBucket: 'artwork-documents',
    storagePath: 'certs/one.pdf',
    accessLevel: 'public',
  });
  assert.equal(result.success, false);
});

test('public artwork list works when the database is reachable', async (t) => {
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    t.skip('database is not reachable from this environment');
    return;
  }

  const response = await api('/api/v1/artworks');
  assert.equal(response.status, 200);
  assert.equal(response.json.success, true);
  assert.equal(Array.isArray(response.json.data.items), true);
});
