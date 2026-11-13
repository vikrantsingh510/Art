import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('gallery entity loaders are request-scoped React.cache wrappers', () => {
  const loaders = read('lib/gallery-entity-loaders.js');
  assert.match(loaders, /cache\(/);
  assert.match(loaders, /loadArtworkById/);
  assert.match(loaders, /loadArtistBySlug/);
  assert.match(loaders, /loadCollectionById/);
  assert.match(loaders, /loadBlogBySlug/);
  assert.match(loaders, /loadCart/);
  assert.match(loaders, /loadWishlist/);
  assert.doesNotMatch(loaders, /unstable_cache|revalidate/);
});

test('artwork, artist, collection and journal routes reuse the cached entity loaders', () => {
  const artwork = read('app/(gallery)/artwork/[id]/page.js');
  const artist = read('app/(gallery)/artists/[slug]/page.js');
  const collection = read('app/(gallery)/collections/[id]/page.js');
  const journal = read('app/(gallery)/journal/[slug]/page.js');

  assert.match(artwork, /loadArtworkById\(id\)/);
  assert.match(artwork, /generateMetadata/);
  assert.match(artwork, /notFound\(\)/);
  assert.doesNotMatch(artwork, /api\.getArtwork/);

  assert.match(artist, /loadArtistBySlug\(slug\)/);
  assert.match(artist, /canonicalFor\(`\/artists\/\$\{slug\}`\)/);
  assert.match(artist, /notFound\(\)/);
  assert.doesNotMatch(artist, /api\.getArtist/);

  assert.match(collection, /loadCollectionById\(id\)/);
  assert.match(collection, /title: collection\.name/);
  assert.match(collection, /notFound\(\)/);
  assert.doesNotMatch(collection, /api\.getCollection/);

  assert.match(journal, /loadBlogBySlug\(slug\)/);
  assert.match(journal, /journalCanonical\(`\/journal\/\$\{slug\}`\)/);
  assert.match(journal, /notFound\(\)/);
  assert.doesNotMatch(journal, /api\.getBlog/);
});

test('gallery layout and cart routes reuse request-scoped cart and wishlist loaders', () => {
  const loaders = read('lib/gallery-entity-loaders.js');
  const layout = read('app/(gallery)/layout.js');
  const cart = read('app/(gallery)/cart/page.js');
  const wishlist = read('app/(gallery)/account/wishlist/page.js');
  const checkout = read('app/(gallery)/checkout/page.js');
  const actions = read('components/collection-actions.js');

  assert.match(loaders, /export const loadCart = cache\(/);
  assert.match(loaders, /export const loadWishlist = cache\(/);
  assert.match(layout, /loadCart\(\)/);
  assert.match(layout, /loadWishlist\(\)/);
  assert.match(layout, /cart\?\.count \?\? cart\?\.items\?\.length \?\? 0/);
  assert.match(layout, /wishlist\?\.count \?\? wishlist\?\.items\?\.length \?\? 0/);
  assert.doesNotMatch(layout, /api\.getCart|api\.getWishlist/);

  assert.match(cart, /loadCart\(\)/);
  assert.doesNotMatch(cart, /api\.getCart/);
  assert.match(wishlist, /loadWishlist\(\)/);
  assert.doesNotMatch(wishlist, /api\.getWishlist/);
  assert.match(checkout, /loadCart\(\)/);
  assert.match(checkout, /listAddresses/);
  assert.doesNotMatch(checkout, /api\.getCart/);
  assert.match(actions, /router\.refresh\(\)/);
});
