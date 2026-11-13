import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hydrateCollectionItems } from '../src/services/item-hydrate.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function soldArtwork(id) {
  return {
    id,
    title: 'Sold hanging',
    status: 'sold',
    isPurchasable: false,
    availableQuantity: 0,
  };
}

test('empty collection rows do not look up artworks', async () => {
  let calls = 0;
  const items = await hydrateCollectionItems([], {
    loadArtworksByIds: async (ids) => {
      calls += 1;
      assert.deepEqual(ids, []);
      return new Map();
    },
  });
  assert.deepEqual(items, []);
  assert.equal(calls, 1);
});

test('a single cart line keeps its item id and purchasable artwork', async () => {
  const artwork = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Available lot',
    status: 'published',
    isPurchasable: true,
    availableQuantity: 1,
  };
  const items = await hydrateCollectionItems([{
    id: 'line-1',
    artworkId: artwork.id,
    createdAt: '2026-01-01T00:00:00.000Z',
  }], {
    loadArtworksByIds: async (ids) => {
      assert.deepEqual(ids, [artwork.id]);
      return new Map([[artwork.id, artwork]]);
    },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'line-1');
  assert.equal(items[0].artworkId, artwork.id);
  assert.equal(items[0].artwork.isPurchasable, true);
});

test('multiple items keep original order and batch a single artwork lookup', async () => {
  const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const third = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  let calls = 0;
  const items = await hydrateCollectionItems([
    { id: 'line-a', artworkId: first, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'line-b', artworkId: second, createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'line-c', artworkId: third, createdAt: '2026-01-03T00:00:00.000Z' },
  ], {
    loadArtworksByIds: async (ids) => {
      calls += 1;
      assert.deepEqual(ids, [first, second, third]);
      return new Map([
        [third, { id: third, title: 'Third', isPurchasable: true }],
        [first, { id: first, title: 'First', isPurchasable: true }],
        [second, { id: second, title: 'Second', isPurchasable: false, status: 'reserved' }],
      ]);
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(items.map((item) => item.id), ['line-a', 'line-b', 'line-c']);
  assert.deepEqual(items.map((item) => item.artwork.title), ['First', 'Second', 'Third']);
  assert.equal(items[1].artwork.status, 'reserved');
  assert.equal(items[1].artwork.isPurchasable, false);
});

test('missing artwork stays on the line as null instead of dropping the item', async () => {
  const missingId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const items = await hydrateCollectionItems([
    { id: 'line-missing', artworkId: missingId, createdAt: '2026-01-01T00:00:00.000Z' },
  ], {
    loadArtworksByIds: async () => new Map(),
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'line-missing');
  assert.equal(items[0].artworkId, missingId);
  assert.equal(items[0].artwork, null);
});

test('sold artwork remains visible on an existing cart or wishlist line', async () => {
  const artwork = soldArtwork('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  const items = await hydrateCollectionItems([
    { id: 'line-sold', artworkId: artwork.id, createdAt: '2026-01-01T00:00:00.000Z' },
  ], {
    loadArtworksByIds: async (ids, options) => {
      assert.equal(options.publicOnly, false);
      return new Map([[artwork.id, artwork]]);
    },
  });
  assert.equal(items[0].artwork.status, 'sold');
  assert.equal(items[0].artwork.isPurchasable, false);
});

test('hydrateCollectionItems batches through getArtworksByIds instead of per-item getArtworkById', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/item-hydrate.js'), 'utf8');
  assert.match(source, /getArtworksByIds/);
  assert.match(source, /publicOnly: false/);
  assert.doesNotMatch(source, /getArtworkById/);
  assert.doesNotMatch(source, /for \(const item of rows\)/);

  const cart = fs.readFileSync(path.join(backendRoot, 'src/services/cart.service.js'), 'utf8');
  assert.match(cart, /hydrateCollectionItems\(items\)/);
  assert.match(cart, /getArtworkById\(artworkId, \{ publicOnly: true \}\)/);

  const wishlist = fs.readFileSync(path.join(backendRoot, 'src/services/wishlist.service.js'), 'utf8');
  assert.match(wishlist, /hydrateCollectionItems\(items\)/);
  assert.match(wishlist, /getArtworkById\(artworkId, \{ publicOnly: false \}\)/);
});
