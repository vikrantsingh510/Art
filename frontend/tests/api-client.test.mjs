import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError, createArtApi } from '../lib/api-client.js';

test('unwraps success envelopes and sends bearer tokens', async () => {
  const calls = [];
  const api = createArtApi({
    baseUrl: 'http://api.test',
    timeoutMs: 1000,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      };
    },
  });

  const data = await api.listArtworks({ q: 'ochre', page: 2 }, { token: 'access-token' });
  assert.deepEqual(data, { items: [], total: 0 });
  assert.match(calls[0].url, /\/api\/v1\/artworks\?q=ochre&page=2/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-token');
});

test('maps Express error envelopes without retrying', async () => {
  let hits = 0;
  const api = createArtApi({
    baseUrl: 'http://api.test',
    fetchImpl: async () => {
      hits += 1;
      return {
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          success: false,
          error: { message: 'Request validation failed', details: [{ path: 'limit', message: 'Too small' }] },
        }),
      };
    },
  });

  await assert.rejects(
    () => api.listArtworks({ limit: 0 }),
    (error) => error instanceof ApiClientError
      && error.status === 400
      && error.message === 'Request validation failed'
      && error.details[0].path === 'limit',
  );
  assert.equal(hits, 1);
});

test('invokes onUnauthorized once for 401 and does not loop', async () => {
  let unauthorized = 0;
  const api = createArtApi({
    baseUrl: 'http://api.test',
    onUnauthorized: async () => {
      unauthorized += 1;
    },
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ success: false, error: { message: 'Invalid or expired access token' } }),
    }),
  });

  await assert.rejects(() => api.getMe(), (error) => error instanceof ApiClientError && error.status === 401);
  assert.equal(unauthorized, 1);
});

test('sends profile, wishlist and admin order paths', async () => {
  const calls = [];
  const api = createArtApi({
    baseUrl: 'http://api.test',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), method: options.method, body: options.body });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { ok: true } }),
      };
    },
  });

  await api.updateMe({ fullName: 'Ada' }, { token: 't' });
  await api.getWishlist({ token: 't' });
  await api.adminOrders({ q: 'MDA', page: 1 }, { token: 't' });
  await api.adminArtworkImageConstraints({ token: 't' });
  assert.match(calls[0].url, /\/api\/v1\/auth\/me$/);
  assert.equal(calls[0].method, 'PATCH');
  assert.match(calls[1].url, /\/api\/v1\/wishlist$/);
  assert.match(calls[2].url, /\/api\/v1\/admin\/orders\?q=MDA&page=1/);
  assert.match(calls[3].url, /\/api\/v1\/admin\/storage\/artwork-images$/);
});
