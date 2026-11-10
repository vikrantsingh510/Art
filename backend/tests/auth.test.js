import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';

function mockIdentity(user) {
  setAuthDependencies({
    verifyAccessToken: async (token) => {
      if (token === 'customer-token') {
        return { userId: customerId, email: 'customer@example.com', fullName: 'Customer' };
      }
      if (token === 'admin-token') {
        return { userId: adminId, email: 'admin@example.com', fullName: 'Admin' };
      }
      if (token === 'expired-token') {
        throw new ApiError(401, 'Invalid or expired access token');
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
});

after(async () => {
  await stopTestServer();
});

test('GET /api/v1/auth/me rejects missing tokens', async () => {
  const response = await api('/api/v1/auth/me');
  assert.equal(response.status, 401);
  assert.equal(response.json.success, false);
});

test('GET /api/v1/auth/me rejects invalid tokens', async () => {
  mockIdentity();
  const response = await api('/api/v1/auth/me', {
    headers: { Authorization: 'Bearer expired-token' },
  });
  assert.equal(response.status, 401);
});

test('GET /api/v1/auth/me accepts a valid customer token', async () => {
  mockIdentity();
  const response = await api('/api/v1/auth/me', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.id, customerId);
  assert.equal(response.json.data.isAdmin, false);
  assert.deepEqual(response.json.data.roles, ['customer']);
});

test('admin ping rejects unauthenticated requests', async () => {
  const response = await api('/api/v1/admin/ping');
  assert.equal(response.status, 401);
});

test('admin ping rejects authenticated customers', async () => {
  mockIdentity();
  const response = await api('/api/v1/admin/ping', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(response.status, 403);
});

test('admin ping allows admin tokens', async () => {
  mockIdentity();
  const response = await api('/api/v1/admin/ping', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.ok, true);
});
