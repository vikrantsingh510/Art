import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError } from '../lib/api-client.js';
import { createCurrentUserLoader, readCurrentUser } from '../lib/current-user.js';

test('duplicate getCurrentUser calls within one loader share one /auth/me request', async () => {
  let hits = 0;
  const getCurrentUser = createCurrentUserLoader({
    getAccessToken: async () => 'token-a',
    getMe: async () => {
      hits += 1;
      return { id: '11111111-1111-4111-8111-111111111111', isAdmin: false };
    },
  });

  const [first, second] = await Promise.all([getCurrentUser(), getCurrentUser()]);
  assert.equal(hits, 1);
  assert.equal(first.user.id, second.user.id);
  assert.equal(first.token, 'token-a');
});

test('two loaders keep authenticated users isolated', async () => {
  const readerA = createCurrentUserLoader({
    getAccessToken: async () => 'token-a',
    getMe: async ({ token }) => ({ id: 'user-a', token }),
  });
  const readerB = createCurrentUserLoader({
    getAccessToken: async () => 'token-b',
    getMe: async ({ token }) => ({ id: 'user-b', token }),
  });

  const [a, b] = await Promise.all([readerA(), readerB()]);
  assert.equal(a.user.id, 'user-a');
  assert.equal(b.user.id, 'user-b');
  assert.notEqual(a.token, b.token);
});

test('readCurrentUser is not globally memoized across calls', async () => {
  let hits = 0;
  const deps = {
    getAccessToken: async () => 'token-a',
    getMe: async () => {
      hits += 1;
      return { id: 'user-a' };
    },
  };
  await readCurrentUser(deps);
  await readCurrentUser(deps);
  assert.equal(hits, 2);
});

test('401 is a signed-out session and 429 is not', async () => {
  const signedOut = createCurrentUserLoader({
    getAccessToken: async () => 'expired',
    getMe: async () => {
      throw new ApiClientError('Invalid or expired access token', { status: 401 });
    },
  });
  const limited = createCurrentUserLoader({
    getAccessToken: async () => 'token-a',
    getMe: async () => {
      throw new ApiClientError('Too many requests', { status: 429, retryAfterSeconds: 9 });
    },
  });

  const anon = await signedOut();
  const paused = await limited();
  assert.equal(anon.user, null);
  assert.equal(anon.token, null);
  assert.equal(paused.unavailable, 'rate_limited');
  assert.equal(paused.token, 'token-a');
  assert.equal(paused.user, null);
  assert.equal(paused.error.status, 429);
});
