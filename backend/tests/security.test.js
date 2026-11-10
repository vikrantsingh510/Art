import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { loadEnv } from '../src/config/env.js';
import { toSafeErrorLog } from '../src/config/logger.js';
import { errorMiddleware } from '../src/middlewares/error.middleware.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '5000',
  FRONTEND_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://maison_app:PASSWORD@localhost:5432/postgres',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_value',
};

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('client-supplied admin flags do not grant admin access', async () => {
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

  const response = await api('/api/v1/admin/ping', {
    method: 'GET',
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(response.status, 403);

  const createResponse = await api('/api/v1/admin/artworks', {
    method: 'POST',
    headers: { Authorization: 'Bearer customer-token' },
    body: {
      title: 'Should fail',
      artistName: 'Artist',
      pricePaise: 1000,
      isAdmin: true,
      role: 'admin',
      userId: '00000000-0000-4000-8000-000000000000',
    },
  });
  assert.equal(createResponse.status, 403);
});

test('environment validation does not echo secret values', () => {
  assert.throws(
    () => loadEnv({
      ...validEnv,
      SUPABASE_PUBLISHABLE_KEY: 'leaked-super-secret-value',
    }),
    (error) => {
      assert.doesNotMatch(error.message, /leaked-super-secret-value/);
      return true;
    },
  );
});

test('unexpected errors return a generic client message', () => {
  const err = new Error('postgresql://postgres:supersecret@db.example:5432/postgres boom');
  let payload;
  const res = {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    },
  };

  errorMiddleware(err, { method: 'GET', originalUrl: '/api/v1/test' }, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(payload.error.message, 'Internal server error');
  assert.doesNotMatch(JSON.stringify(payload), /supersecret/);
});

test('safe error logs redact database URLs', () => {
  const safe = toSafeErrorLog(new Error('Failed postgresql://postgres:supersecret@localhost:5432/postgres'));
  assert.doesNotMatch(safe.message, /supersecret/);
  assert.match(safe.message, /postgresql:\/\/\*\*\*/);
});
