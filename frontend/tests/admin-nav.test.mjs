import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_NAV_LINKS, isAdminNavActive } from '../lib/admin-nav.js';

test('dashboard is active only on the console index', () => {
  assert.equal(isAdminNavActive('/admin', '/admin'), true);
  assert.equal(isAdminNavActive('/admin/artworks', '/admin'), false);
  assert.equal(isAdminNavActive('/admin/orders', '/admin'), false);
  assert.equal(isAdminNavActive('/admin/customers/abc', '/admin'), false);
});

test('artwork collection stays highlighted on edit and not on the new-lot form', () => {
  assert.equal(isAdminNavActive('/admin/artworks', '/admin/artworks'), true);
  assert.equal(isAdminNavActive('/admin/artworks/lot-id/edit', '/admin/artworks'), true);
  assert.equal(isAdminNavActive('/admin/artworks/new', '/admin/artworks'), false);
  assert.equal(isAdminNavActive('/admin/artworks/new', '/admin/artworks/new'), true);
});

test('journal highlights listing and edit without colliding with artwork routes', () => {
  assert.equal(isAdminNavActive('/admin/blogs', '/admin/blogs'), true);
  assert.equal(isAdminNavActive('/admin/blogs/entry-id/edit', '/admin/blogs'), true);
  assert.equal(isAdminNavActive('/admin/blogs/new', '/admin/blogs'), true);
  assert.equal(isAdminNavActive('/admin/artworks', '/admin/blogs'), false);
});

test('orders and customers highlight their nested records', () => {
  assert.equal(isAdminNavActive('/admin/orders', '/admin/orders'), true);
  assert.equal(isAdminNavActive('/admin/orders/order-id', '/admin/orders'), true);
  assert.equal(isAdminNavActive('/admin/customers', '/admin/customers'), true);
  assert.equal(isAdminNavActive('/admin/customers/user-id', '/admin/customers'), true);
  assert.equal(isAdminNavActive('/admin/orders', '/admin/customers'), false);
});

test('console lists the curatorial side-menu destinations', () => {
  assert.deepEqual(
    ADMIN_NAV_LINKS.map((link) => link.label),
    ['Dashboard', 'Artwork collection', 'Add new artwork', 'Journal', 'Orders', 'Customers'],
  );
});
