import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { selectDefaultAfterDelete, shouldPromoteDefault } from '../src/utils/address-defaults.js';
import { addressPatchBody } from '../src/validators/cart.validators.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const addressId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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
      profile: { id: customerId, fullName: 'Customer' },
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

test('deleting the default promotes the most recently updated remaining address', () => {
  const deleted = { id: 'a', isDefault: true };
  const remaining = [
    { id: 'b', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'c', updatedAt: '2026-06-01T00:00:00.000Z' },
  ];
  const next = selectDefaultAfterDelete(remaining, deleted.id);
  assert.equal(next.id, 'c');
  assert.equal(shouldPromoteDefault(deleted, next), true);
  assert.equal(selectDefaultAfterDelete([], 'a'), null);
});

test('address patch requires at least one field and rejects userId', () => {
  assert.equal(addressPatchBody.safeParse({}).success, false);
  assert.equal(addressPatchBody.safeParse({ userId: customerId }).success, false);
  assert.equal(addressPatchBody.safeParse({ city: 'Mumbai' }).success, true);
});

test('PATCH /api/v1/addresses/:id requires authentication', async () => {
  const response = await api(`/api/v1/addresses/${addressId}`, {
    method: 'PATCH',
    body: { city: 'Mumbai' },
  });
  assert.equal(response.status, 401);
});

test('DELETE /api/v1/addresses/:id requires authentication', async () => {
  const response = await api(`/api/v1/addresses/${addressId}`, { method: 'DELETE' });
  assert.equal(response.status, 401);
});

test('PATCH /api/v1/addresses/:id rejects missing ids', async () => {
  mockCustomer();
  const response = await api('/api/v1/addresses/not-a-uuid', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer customer-token' },
    body: { city: 'Mumbai' },
  });
  assert.equal(response.status, 400);
});
