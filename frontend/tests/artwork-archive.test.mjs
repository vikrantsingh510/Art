import assert from 'node:assert/strict';
import test from 'node:test';
import { canShowArchiveAction } from '../lib/artwork-archive.js';

test('archived artwork does not show the Archive action', () => {
  assert.equal(canShowArchiveAction({ id: 'a1', status: 'archived', title: 'Hanging' }), false);
});

test('published artwork keeps the Archive action', () => {
  assert.equal(canShowArchiveAction({ id: 'a2', status: 'published', title: 'Salon piece' }), true);
});

test('draft artwork keeps the existing Archive action', () => {
  assert.equal(canShowArchiveAction({ id: 'a3', status: 'draft', title: 'Studio lot' }), true);
});

test('reserved and sold artworks keep the existing Archive action', () => {
  assert.equal(canShowArchiveAction({ status: 'reserved' }), true);
  assert.equal(canShowArchiveAction({ status: 'sold' }), true);
});
