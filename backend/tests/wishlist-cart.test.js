import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const artworkId = '44444444-4444-4444-8444-444444444444';

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

function independentStores() {
  const cart = new Set();
  const wishlist = new Set();
  return {
    addCart(id) { cart.add(id); },
    addWishlist(id) { wishlist.add(id); },
    removeCart(id) { cart.delete(id); },
    removeWishlist(id) { wishlist.delete(id); },
    checkout() { cart.clear(); },
    snapshot() { return { cart: [...cart], wishlist: [...wishlist] }; },
  };
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('wishlist and cart stores stay independent through add/remove/checkout', () => {
  const store = independentStores();
  store.addWishlist(artworkId);
  store.addCart(artworkId);
  assert.deepEqual(store.snapshot(), { cart: [artworkId], wishlist: [artworkId] });
  store.removeWishlist(artworkId);
  assert.deepEqual(store.snapshot(), { cart: [artworkId], wishlist: [] });
  store.addWishlist(artworkId);
  store.checkout();
  assert.deepEqual(store.snapshot(), { cart: [], wishlist: [artworkId] });
});

test('GET /api/v1/wishlist requires authentication', async () => {
  const response = await api('/api/v1/wishlist');
  assert.equal(response.status, 401);
});

test('POST /api/v1/wishlist/items requires authentication', async () => {
  const response = await api('/api/v1/wishlist/items', {
    method: 'POST',
    body: { artworkId },
  });
  assert.equal(response.status, 401);
});

test('POST /api/v1/wishlist/items rejects invalid payloads for authenticated users', async () => {
  mockCustomer();
  const response = await api('/api/v1/wishlist/items', {
    method: 'POST',
    headers: { Authorization: 'Bearer customer-token' },
    body: {},
  });
  assert.equal(response.status, 400);
});

test('cart mutations still require authentication after the split', async () => {
  const response = await api('/api/v1/cart/items', {
    method: 'POST',
    body: { artworkId },
  });
  assert.equal(response.status, 401);
});
