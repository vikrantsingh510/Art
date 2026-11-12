import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_NAV_LINKS, isAdminNavActive } from '../lib/admin-nav.js';

test('dashboard is active only on the console index', () => {
  assert.equal(isAdminNavActive('/admin', '/admin'), true);
  assert.equal(isAdminNavActive('/admin/artworks', '/admin'), false);
  assert.equal(isAdminNavActive('/admin/settings', '/admin'), false);
  assert.equal(isAdminNavActive('/admin/orders', '/admin'), false);
  assert.equal(isAdminNavActive('/admin/customers/abc', '/admin'), false);
});

test('settings highlights without colliding with the dashboard', () => {
  assert.equal(isAdminNavActive('/admin/settings', '/admin/settings'), true);
  assert.equal(isAdminNavActive('/admin', '/admin/settings'), false);
  assert.equal(isAdminNavActive('/admin/artworks', '/admin/settings'), false);
});

test('artwork collection stays highlighted on edit and not on the new-lot form', () => {
  assert.equal(isAdminNavActive('/admin/artworks', '/admin/artworks'), true);
  assert.equal(isAdminNavActive('/admin/artworks/lot-id/edit', '/admin/artworks'), true);
  assert.equal(isAdminNavActive('/admin/artworks/new', '/admin/artworks'), false);
  assert.equal(isAdminNavActive('/admin/artworks/new', '/admin/artworks/new'), true);
});

test('collections highlights listing, new and edit without colliding with artwork routes', () => {
  assert.equal(isAdminNavActive('/admin/collections', '/admin/collections'), true);
  assert.equal(isAdminNavActive('/admin/collections/entry-id/edit', '/admin/collections'), true);
  assert.equal(isAdminNavActive('/admin/collections/new', '/admin/collections'), true);
  assert.equal(isAdminNavActive('/admin/artworks', '/admin/collections'), false);
  assert.equal(isAdminNavActive('/admin/collections', '/admin/artworks'), false);
});

test('journal highlights listing and edit without colliding with artwork routes', () => {
  assert.equal(isAdminNavActive('/admin/blogs', '/admin/blogs'), true);
  assert.equal(isAdminNavActive('/admin/blogs/entry-id/edit', '/admin/blogs'), true);
  assert.equal(isAdminNavActive('/admin/blogs/new', '/admin/blogs'), true);
  assert.equal(isAdminNavActive('/admin/artworks', '/admin/blogs'), false);
});

test('artists highlights listing, new and edit without colliding with artwork routes', () => {
  assert.equal(isAdminNavActive('/admin/artists', '/admin/artists'), true);
  assert.equal(isAdminNavActive('/admin/artists/entry-id/edit', '/admin/artists'), true);
  assert.equal(isAdminNavActive('/admin/artists/new', '/admin/artists'), true);
  assert.equal(isAdminNavActive('/admin/artworks', '/admin/artists'), false);
  assert.equal(isAdminNavActive('/admin/artists', '/admin/artworks'), false);
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
    ['Dashboard', 'Settings', 'Artwork collection', 'Add new artwork', 'Journal', 'Collections', 'Artists', 'Orders', 'Customers'],
  );
});
