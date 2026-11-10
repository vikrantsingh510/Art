import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

after(async () => {
  resetAuthDependencies();
  await stopTestServer();
});

test('Express does not mount a request-count rate limiter', () => {
  const appSource = fs.readFileSync(path.join(backendRoot, 'src/app.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8'));
  assert.equal(fs.existsSync(path.join(backendRoot, 'src/middlewares/rate-limit.middleware.js')), false);
  assert.doesNotMatch(appSource, /rateLimit|createApiRateLimitMiddleware|express-rate-limit/);
  assert.equal(packageJson.dependencies['express-rate-limit'], undefined);
});

test('Express does not own login, OTP or contact APIs', () => {
  const authRoutes = fs.readFileSync(path.join(backendRoot, 'src/routes/auth.routes.js'), 'utf8');
  const apiIndex = fs.readFileSync(path.join(backendRoot, 'src/routes/index.js'), 'utf8');
  assert.match(authRoutes, /router\.get\('\/me'/);
  assert.match(authRoutes, /router\.patch\('\/me'/);
  assert.doesNotMatch(authRoutes, /login|otp|password|recover|signup|contact/i);
  assert.doesNotMatch(apiIndex, /contact/i);
});

test('auth middleware does not cache authenticated users globally', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/middlewares/auth.middleware.js'), 'utf8');
  assert.match(source, /req\.user\s*=/);
  assert.doesNotMatch(source, /new Map|WeakMap|userCache|authenticatedUsers/);
});

test('repeated artwork reads are not request-capped', async () => {
  for (let index = 0; index < 20; index += 1) {
    const response = await api('/api/v1/artworks?page=1&limit=1');
    assert.notEqual(response.status, 429, `artwork read ${index} was rate-limited`);
  }
});

test('repeated /auth/me and admin dashboard reads are not request-capped', async () => {
  mockIdentity();
  for (let index = 0; index < 20; index += 1) {
    const me = await api('/api/v1/auth/me', {
      headers: { Authorization: 'Bearer admin-token' },
    });
    const metrics = await api('/api/v1/admin/metrics', {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.notEqual(me.status, 429, `/auth/me ${index} was rate-limited`);
    assert.notEqual(metrics.status, 429, `admin metrics ${index} was rate-limited`);
    assert.equal(me.status, 200);
  }
});

test('normal authenticated writes are not request-capped', async () => {
  mockIdentity();
  for (let index = 0; index < 20; index += 1) {
    const response = await api('/api/v1/admin/artworks', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: { title: '' },
    });
    assert.notEqual(response.status, 429, `admin create ${index} was rate-limited`);
    assert.equal(response.status, 400);
  }
});

test('two authenticated users on one IP do not restrict each other', async () => {
  mockIdentity();
  for (let index = 0; index < 10; index += 1) {
    const admin = await api('/api/v1/auth/me', {
      headers: { Authorization: 'Bearer admin-token' },
    });
    const customer = await api('/api/v1/auth/me', {
      headers: { Authorization: 'Bearer customer-token' },
    });
    assert.equal(admin.status, 200);
    assert.equal(customer.status, 200);
  }
});
