import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { provisionCustomerIdentity } from '../src/services/identity.service.js';
import { ApiError } from '../src/utils/ApiError.js';
import { api, stopTestServer } from './helpers/http.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';

function thenable(value) {
  return {
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function createExecutor({ existingIds = new Set(), failOn = null } = {}) {
  const inserts = [];
  const notifications = [];

  const executor = {
    inserts,
    notifications,
    async transaction(callback) {
      const tx = {
        select() {
          const query = {
            from() { return query; },
            where() { return query; },
            limit() { return query; },
            then(resolve, reject) {
              if (failOn === 'select') {
                return Promise.reject(new Error('profile lookup failed')).then(resolve, reject);
              }
              const rows = existingIds.has(customerId) ? [{ id: customerId }] : [];
              return Promise.resolve(rows).then(resolve, reject);
            },
          };
          return query;
        },
        insert(table) {
          if (failOn === 'insert') {
            throw new Error('provision insert failed');
          }
          const chain = {
            values(values) {
              inserts.push({ table, values });
              chain._values = values;
              return chain;
            },
            onConflictDoNothing() {
              return chain;
            },
            returning() {
              const created = !existingIds.has(chain._values?.id);
              if (created && chain._values?.id) {
                existingIds.add(chain._values.id);
              }
              const isNotification = Boolean(chain._values?.eventType);
              if (isNotification) {
                notifications.push(chain._values);
              }
              return thenable(created && chain._values?.id ? [{ id: chain._values.id }] : []);
            },
            then(resolve, reject) {
              const isNotification = Boolean(chain._values?.eventType);
              if (isNotification) {
                notifications.push(chain._values);
              }
              return Promise.resolve({ rowCount: 1 }).then(resolve, reject);
            },
          };
          return chain;
        },
      };
      return callback(tx);
    },
  };

  return executor;
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('auth middleware still verifies the access token before provisioning and loading roles', () => {
  const middleware = fs.readFileSync(path.join(backendRoot, 'src/middlewares/auth.middleware.js'), 'utf8');
  const authService = fs.readFileSync(path.join(backendRoot, 'src/services/auth.service.js'), 'utf8');
  const identity = fs.readFileSync(path.join(backendRoot, 'src/services/identity.service.js'), 'utf8');

  assert.match(authService, /\/auth\/v1\/user/);
  assert.match(middleware, /const identity = await verifyAccessToken\(token\)/);
  assert.match(middleware, /await provisionIdentity\(\{/);
  assert.match(middleware, /loadProfileWithRoles\(identity\.userId\)/);
  assert.match(middleware, /isAdmin: roles\.includes\('admin'\)/);
  assert.doesNotMatch(middleware, /new Map|WeakMap|userCache|authenticatedUsers/);
  assert.doesNotMatch(middleware, /jwt\.verify|jose|jsonwebtoken/);
  assert.match(identity, /if \(existing\) \{\s*return;/);
  assert.match(identity, /onConflictDoNothing\(\)\.returning/);
});

test('an existing profile skips identity inserts but first login still provisions', async () => {
  const existing = createExecutor({ existingIds: new Set([customerId]) });
  await provisionCustomerIdentity({
    userId: customerId,
    fullName: 'Customer',
    email: 'customer@example.com',
  }, { executor: existing });
  assert.equal(existing.inserts.length, 0);
  assert.equal(existing.notifications.length, 0);

  const firstLogin = createExecutor();
  await provisionCustomerIdentity({
    userId: customerId,
    fullName: 'Customer',
    email: 'customer@example.com',
  }, { executor: firstLogin });

  assert.equal(firstLogin.inserts.length >= 4, true);
  assert.equal(firstLogin.notifications.length, 1);
  assert.equal(firstLogin.notifications[0].eventType, 'customer.welcome');
});

test('welcome notification is enqueued at most once when two first logins race', async () => {
  const existingIds = new Set();
  const executor = createExecutor({ existingIds });
  await Promise.all([
    provisionCustomerIdentity({
      userId: customerId,
      fullName: 'Customer',
      email: 'customer@example.com',
    }, { executor }),
    provisionCustomerIdentity({
      userId: customerId,
      fullName: 'Customer',
      email: 'customer@example.com',
    }, { executor }),
  ]);

  assert.equal(executor.notifications.length, 1);
});

test('provisioning lookup and insert failures fail closed', async () => {
  await assert.rejects(
    () => provisionCustomerIdentity({
      userId: customerId,
      fullName: 'Customer',
      email: 'customer@example.com',
    }, { executor: createExecutor({ failOn: 'select' }) }),
    /profile lookup failed/,
  );

  await assert.rejects(
    () => provisionCustomerIdentity({
      userId: customerId,
      fullName: 'Customer',
      email: 'customer@example.com',
    }, { executor: createExecutor({ failOn: 'insert' }) }),
    /provision insert failed/,
  );
});

test('missing, invalid and expired tokens never reach identity provisioning', async () => {
  let provisioned = 0;
  setAuthDependencies({
    verifyAccessToken: async (token) => {
      if (token === 'expired-token' || token === 'invalid-token') {
        throw new ApiError(401, 'Invalid or expired access token');
      }
      throw new ApiError(401, 'Invalid or expired access token');
    },
    provisionIdentity: async () => {
      provisioned += 1;
    },
    loadProfileWithRoles: async () => ({ profile: null, roles: [] }),
  });

  const missing = await api('/api/v1/auth/me');
  const invalid = await api('/api/v1/auth/me', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  const expired = await api('/api/v1/auth/me', {
    headers: { Authorization: 'Bearer expired-token' },
  });

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(expired.status, 401);
  assert.equal(provisioned, 0);
});

test('every authenticated request still verifies, provisions and reloads authoritative roles', async () => {
  const calls = [];
  let roles = ['customer'];
  setAuthDependencies({
    verifyAccessToken: async (token) => {
      calls.push('verify');
      if (token !== 'customer-token' && token !== 'admin-token') {
        throw new ApiError(401, 'Invalid or expired access token');
      }
      return {
        userId: token === 'admin-token' ? adminId : customerId,
        email: 'user@example.com',
        fullName: 'User',
      };
    },
    provisionIdentity: async () => {
      calls.push('provision');
    },
    loadProfileWithRoles: async (userId) => {
      calls.push('roles');
      return {
        profile: { id: userId, fullName: 'User' },
        roles: userId === adminId ? roles : ['customer'],
      };
    },
  });

  const me = await api('/api/v1/auth/me', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  const cart = await api('/api/v1/cart');
  const wishlist = await api('/api/v1/wishlist');
  const checkoutUnauth = await api('/api/v1/checkout', {
    method: 'POST',
    body: {},
  });
  const checkoutAuth = await api('/api/v1/checkout', {
    method: 'POST',
    headers: { Authorization: 'Bearer customer-token' },
    body: {},
  });

  assert.equal(me.status, 200);
  assert.equal(cart.status, 401);
  assert.equal(wishlist.status, 401);
  assert.equal(checkoutUnauth.status, 401);
  assert.equal(checkoutAuth.status, 400);
  assert.deepEqual(calls, [
    'verify', 'provision', 'roles',
    'verify', 'provision', 'roles',
  ]);
});

test('admin authorization follows the latest user_roles load and ignores client isAdmin', async () => {
  let roles = ['customer', 'admin'];
  setAuthDependencies({
    verifyAccessToken: async (token) => {
      if (token !== 'admin-token') {
        throw new ApiError(401, 'Invalid or expired access token');
      }
      return { userId: adminId, email: 'admin@example.com', fullName: 'Admin' };
    },
    provisionIdentity: async () => {},
    loadProfileWithRoles: async () => ({
      profile: { id: adminId, fullName: 'Admin' },
      roles,
    }),
  });

  const allowed = await api('/api/v1/admin/ping', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(allowed.status, 200);

  roles = ['customer'];
  const revoked = await api('/api/v1/admin/ping', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  const flagged = await api('/api/v1/admin/artworks', {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token' },
    body: {
      title: 'Should fail',
      artistName: 'Artist',
      pricePaise: 1000,
      isAdmin: true,
      role: 'admin',
    },
  });
  assert.equal(revoked.status, 403);
  assert.equal(flagged.status, 403);
});
