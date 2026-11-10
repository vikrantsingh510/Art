import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessAdmin, isSignedIn } from '../lib/guards.js';

test('admin access trusts only the API isAdmin flag', () => {
  assert.equal(canAccessAdmin({ isAdmin: true }), true);
  assert.equal(canAccessAdmin({ role: 'admin', isAdmin: false }), false);
  assert.equal(canAccessAdmin({ roles: ['admin'] }), false);
  assert.equal(canAccessAdmin(null), false);
});

test('signed-in check uses the provisioned user id', () => {
  assert.equal(isSignedIn({ id: '11111111-1111-4111-8111-111111111111' }), true);
  assert.equal(isSignedIn({}), false);
});
