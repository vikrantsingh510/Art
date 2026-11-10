import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { env } from '../src/config/env.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
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

test('health endpoint remains public', async () => {
  const response = await api('/api/v1/health');
  assert.equal(response.status, 200);
  assert.equal(response.json.success, true);
});

test('unknown routes return a consistent 404', async () => {
  const response = await api('/api/v1/does-not-exist');
  assert.equal(response.status, 404);
  assert.equal(response.json.success, false);
});

test('public artwork list rejects invalid query input', async () => {
  const response = await api('/api/v1/artworks?limit=0');
  assert.equal(response.status, 400);
});

test('public artwork detail rejects invalid ids', async () => {
  const response = await api('/api/v1/artworks/not-a-uuid');
  assert.equal(response.status, 400);
});

test('admin artwork create rejects unauthenticated requests', async () => {
  const response = await api('/api/v1/admin/artworks', {
    method: 'POST',
    body: { title: 'Test', artistName: 'Artist', pricePaise: 100 },
  });
  assert.equal(response.status, 401);
});

test('cart requires authentication', async () => {
  const response = await api('/api/v1/cart');
  assert.equal(response.status, 401);
});

test('checkout rejects invalid payloads for authenticated users', async () => {
  mockCustomer();
  const response = await api('/api/v1/checkout', {
    method: 'POST',
    headers: { Authorization: 'Bearer customer-token' },
    body: {},
  });
  assert.equal(response.status, 400);
});

test('razorpay webhook is rejected when credentials are absent', async () => {
  const response = await api('/api/v1/webhooks/razorpay', {
    method: 'POST',
    body: { event: 'payment.captured' },
  });
  assert.equal(response.status, env.RAZORPAY_WEBHOOK_SECRET ? 401 : 503);
});
