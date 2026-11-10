import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { applyProfilePatch, hasForbiddenProfileKeys, normalizePhone } from '../src/utils/profile-fields.js';
import { profilePatchBody } from '../src/validators/profile.validators.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';

function mockCustomer() {
  setAuthDependencies({
    verifyAccessToken: async (token) => {
      if (token !== 'customer-token') {
        throw new ApiError(401, 'Invalid or expired access token');
      }
      return { userId: customerId, email: 'customer@example.com', fullName: 'Customer' };
    },
    provisionIdentity: async () => {},
    loadProfileWithRoles: async () => ({
      profile: { id: customerId, fullName: 'Customer', phone: null },
      roles: ['customer'],
    }),
  });
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('profile patch rejects empty bodies and forbidden keys', () => {
  assert.equal(profilePatchBody.safeParse({}).success, false);
  assert.equal(profilePatchBody.safeParse({ isAdmin: true }).success, false);
  assert.equal(profilePatchBody.safeParse({ email: 'stolen@example.com' }).success, false);
  assert.equal(profilePatchBody.safeParse({ fullName: 'Ada' }).success, true);
  assert.deepEqual(hasForbiddenProfileKeys({ isAdmin: true, role: 'admin' }), ['role', 'isAdmin']);
});

test('profile patch normalizes blanks and phone spacing', () => {
  const next = applyProfilePatch({ fullName: 'Ada', phone: '999' }, { fullName: '  ', phone: ' 98 76 ' });
  assert.equal(next.fullName, null);
  assert.equal(normalizePhone(' 98 76 '), '98 76');
  assert.equal(next.phone, '98 76');
});

test('PATCH /api/v1/auth/me rejects missing tokens', async () => {
  const response = await api('/api/v1/auth/me', {
    method: 'PATCH',
    body: { fullName: 'Ada' },
  });
  assert.equal(response.status, 401);
});

test('PATCH /api/v1/auth/me rejects forbidden field injection', async () => {
  mockCustomer();
  const response = await api('/api/v1/auth/me', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer customer-token' },
    body: { fullName: 'Ada', isAdmin: true },
  });
  assert.equal(response.status, 400);
});

test('PATCH /api/v1/auth/me rejects invalid phone', async () => {
  mockCustomer();
  const response = await api('/api/v1/auth/me', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer customer-token' },
    body: { phone: '1' },
  });
  assert.equal(response.status, 400);
});
