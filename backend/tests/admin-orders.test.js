import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { compactAdminOrderRow, exactOrderUuid, searchTerm } from '../src/utils/admin-orders-query.js';
import { adminOrdersQuery } from '../src/validators/admin.validators.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';

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
});

after(async () => {
  await stopTestServer();
});

test('admin orders validator preserves q and allowlisted filters', () => {
  const parsed = adminOrdersQuery.parse({
    q: 'MDA-2026',
    status: 'pending_payment',
    paymentStatus: 'captured',
    page: '2',
    limit: '10',
  });
  assert.equal(parsed.q, 'MDA-2026');
  assert.equal(parsed.status, 'pending_payment');
  assert.equal(parsed.page, 2);
  assert.equal(adminOrdersQuery.safeParse({ status: 'paid' }).success, false);
  assert.equal(adminOrdersQuery.safeParse({ limit: '1000' }).success, false);
});

test('exact UUID search is distinguished from free-text q', () => {
  const id = '33333333-3333-4333-8333-333333333333';
  assert.equal(exactOrderUuid({ q: id }), id);
  assert.equal(searchTerm({ q: id }), null);
  assert.equal(searchTerm({ q: 'MDA' }), 'MDA');
});

test('compact admin order rows omit address snapshots', () => {
  const row = compactAdminOrderRow({
    id: 'o1',
    orderNumber: 'MDA-1',
    placedAt: '2026-01-01T00:00:00.000Z',
    status: 'pending_payment',
    itemCount: 2,
    totalPaise: 1000,
    currency: 'INR',
    customerId: customerId,
    customerFullName: 'Ada',
    customerPhone: '9999999999',
    paymentStatus: null,
    reservationExpiresAt: null,
    shippingAddressSnapshot: { addressLine1: 'should not leak' },
  });
  assert.equal(row.shippingAddressSnapshot, undefined);
  assert.equal(row.customerFullName, 'Ada');
  assert.equal(row.itemCount, 2);
});

test('GET /api/v1/admin/orders rejects anonymous callers', async () => {
  const response = await api('/api/v1/admin/orders');
  assert.equal(response.status, 401);
});

test('GET /api/v1/admin/orders rejects customers', async () => {
  mockIdentity();
  const response = await api('/api/v1/admin/orders', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(response.status, 403);
});

test('GET /api/v1/admin/orders rejects malformed query even for admins', async () => {
  mockIdentity();
  const response = await api('/api/v1/admin/orders?status=not-a-status', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(response.status, 400);
});

test('GET /api/v1/admin/orders returns a compact list when the database is reachable', async (t) => {
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    t.skip('database is not reachable from this environment');
    return;
  }

  mockIdentity();
  const response = await api('/api/v1/admin/orders?q=MDA&limit=5', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.json.data.items), true);
  assert.equal(Object.hasOwn(response.json.data.items[0] || {}, 'shippingAddressSnapshot'), false);
});
