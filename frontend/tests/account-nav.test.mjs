import assert from 'node:assert/strict';
import test from 'node:test';
import { ACCOUNT_NAV_LINKS, isAccountNavActive } from '../lib/account-nav.js';

test('overview is active only on the account index', () => {
  assert.equal(isAccountNavActive('/account', '/account'), true);
  assert.equal(isAccountNavActive('/account/profile', '/account'), false);
  assert.equal(isAccountNavActive('/account/orders', '/account'), false);
  assert.equal(isAccountNavActive('/account/orders/abc', '/account'), false);
});

test('nested account pages highlight their own nav item', () => {
  assert.equal(isAccountNavActive('/account/profile', '/account/profile'), true);
  assert.equal(isAccountNavActive('/account/addresses', '/account/addresses'), true);
  assert.equal(isAccountNavActive('/account/wishlist', '/account/wishlist'), true);
  assert.equal(isAccountNavActive('/account/orders', '/account/orders'), true);
  assert.equal(isAccountNavActive('/account/orders/lot-1', '/account/orders'), true);
});

test('profile is not treated as addresses or orders', () => {
  assert.equal(isAccountNavActive('/account/profile', '/account/addresses'), false);
  assert.equal(isAccountNavActive('/account/profile', '/account/orders'), false);
  assert.equal(isAccountNavActive('/cart', '/account'), false);
});

test('account dossier lists the collector side-menu destinations', () => {
  assert.deepEqual(
    ACCOUNT_NAV_LINKS.map((link) => link.label),
    ['Overview', 'Profile', 'Addresses', 'Wishlist', 'Bag', 'Orders'],
  );
});
