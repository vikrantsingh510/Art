import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError, createArtApi, parseRetryAfter } from '../lib/api-client.js';

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

test('parses Retry-After as seconds or an HTTP date', () => {
  assert.equal(parseRetryAfter('12'), 12);
  assert.equal(parseRetryAfter('0'), 0);
  assert.equal(parseRetryAfter(''), null);
  const later = new Date(Date.now() + 5000).toUTCString();
  const seconds = parseRetryAfter(later);
  assert.ok(seconds >= 4 && seconds <= 6);
});

test('429 preserves retry metadata and does not retry or sign out', async () => {
  let hits = 0;
  let unauthorized = 0;
  const api = createArtApi({
    baseUrl: 'http://api.test',
    onUnauthorized: async () => {
      unauthorized += 1;
    },
    fetchImpl: async () => {
      hits += 1;
      return {
        ok: false,
        status: 429,
        headers: { get: (name) => (name.toLowerCase() === 'retry-after' ? '8' : null) },
        text: async () => JSON.stringify({ success: false, error: { message: 'Too many requests' } }),
      };
    },
  });

  await assert.rejects(
    () => api.getMe(),
    (error) => error instanceof ApiClientError
      && error.status === 429
      && error.retryAfterSeconds === 8
      && /Retry in 8 seconds/.test(error.message),
  );
  assert.equal(hits, 1);
  assert.equal(unauthorized, 0);
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
  await api.removeArtworkImage('lot-id', 'image-id', { token: 't' });
  await api.reorderArtworkImages('lot-id', { imageIds: ['image-id'], primaryImageId: 'image-id' }, { token: 't' });
  await api.getWhatsappEnquiry();
  await api.adminWhatsappSettings({ token: 't' });
  await api.updateAdminWhatsappSettings({ enabled: false }, { token: 't' });
  await api.createCollection({ name: 'Monsoon studies' }, { token: 't' });
  await api.replaceCollectionArtworks('col-id', ['lot-id'], { token: 't' });
  assert.match(calls[0].url, /\/api\/v1\/auth\/me$/);
  assert.equal(calls[0].method, 'PATCH');
  assert.match(calls[1].url, /\/api\/v1\/wishlist$/);
  assert.match(calls[2].url, /\/api\/v1\/admin\/orders\?q=MDA&page=1/);
  assert.match(calls[3].url, /\/api\/v1\/admin\/storage\/artwork-images$/);
  assert.match(calls[4].url, /\/api\/v1\/admin\/artworks\/lot-id\/images\/image-id$/);
  assert.equal(calls[4].method, 'DELETE');
  assert.match(calls[5].url, /\/api\/v1\/admin\/artworks\/lot-id\/images\/order$/);
  assert.equal(calls[5].method, 'PATCH');
  assert.match(calls[6].url, /\/api\/v1\/enquiry\/whatsapp$/);
  assert.equal(calls[6].method, 'GET');
  assert.match(calls[7].url, /\/api\/v1\/admin\/settings\/whatsapp$/);
  assert.equal(calls[7].method, 'GET');
  assert.match(calls[8].url, /\/api\/v1\/admin\/settings\/whatsapp$/);
  assert.equal(calls[8].method, 'PUT');
  assert.match(calls[9].url, /\/api\/v1\/admin\/collections$/);
  assert.equal(calls[9].method, 'POST');
  assert.match(calls[10].url, /\/api\/v1\/admin\/collections\/col-id\/artworks$/);
  assert.equal(calls[10].method, 'PUT');
});
