import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { previewAspectRatio } from '../lib/ar-assets/storefront.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('landscape 3:2 portrait 3:4 and square frames use admin physical ratios', () => {
  const landscape = previewAspectRatio({ width: 91.44, height: 60.96, dimensionUnit: 'cm' });
  assert.equal(landscape.source, 'admin');
  assert.equal(landscape.width / landscape.height, 91.44 / 60.96);
  assert.equal(Number((landscape.width / landscape.height).toFixed(2)), 1.5);

  const portrait = previewAspectRatio({ width: 90, height: 120, dimensionUnit: 'cm' });
  assert.equal(portrait.source, 'admin');
  assert.equal(portrait.width / portrait.height, 90 / 120);
  assert.equal(Number((portrait.width / portrait.height).toFixed(2)), 0.75);

  const square = previewAspectRatio({ width: 100, height: 100, dimensionUnit: 'cm' });
  assert.equal(square.source, 'admin');
  assert.equal(square.width / square.height, 1);
});

test('missing or invalid physical dimensions fall back to 4:5', () => {
  assert.deepEqual(previewAspectRatio({ width: 90, height: 120 }), {
    width: 4,
    height: 5,
    source: 'fallback',
  });
  assert.deepEqual(previewAspectRatio({ width: 90, height: 120, dimensionUnit: 'yd' }), {
    width: 4,
    height: 5,
    source: 'fallback',
  });
  assert.deepEqual(previewAspectRatio({}), {
    width: 4,
    height: 5,
    source: 'fallback',
  });
});

test('artwork cards pass physical fit through ArtworkImage and never cover the painting', () => {
  const card = read('components/artwork-card.js');
  const image = read('components/artwork-image.js');
  const loading = read('components/loading.js');

  assert.match(card, /<ArtworkImage artwork=\{artwork\} fit="physical" hover=\{false\} \/>/);
  assert.doesNotMatch(card, /previewAspectRatio/);
  assert.doesNotMatch(card, /object-cover/);

  assert.match(image, /previewAspectRatio\(artwork\)/);
  assert.match(image, /fit === 'physical' \? previewAspectRatio\(artwork\)/);
  assert.match(image, /object-contain/);
  assert.doesNotMatch(image, /object-cover/);
  assert.match(image, /aspectRatio=\{frameStyle\.aspectRatio\}/);

  assert.match(loading, /previewAspectRatio/);
  assert.match(loading, /aspectRatio = '4 \/ 5'/);
  assert.match(loading, /ArtworkCardSkeleton\(\{ artwork \}/);
  assert.match(loading, /artworks/);
  assert.doesNotMatch(loading, /object-cover/);
});

test('wishlist homepage explore collection and journal keep the shared ArtworkCard', () => {
  const wishlist = read('app/(gallery)/account/wishlist/page.js');
  const home = read('app/(gallery)/(salon)/page.js');
  const explore = read('app/(gallery)/explore/page.js');
  const collection = read('app/(gallery)/collections/[id]/page.js');
  const journal = read('app/(gallery)/journal/[slug]/page.js');

  for (const source of [wishlist, home, explore, collection, journal]) {
    assert.match(source, /ArtworkCard/);
    assert.doesNotMatch(source, /<ArtworkImage[\s\S]*object-cover/);
  }

  assert.match(wishlist, /showFavourite=\{false\}/);
  assert.match(wishlist, /WishlistItemActions/);
});

test('storefront artwork cards do not scale the painting beyond its frame', () => {
  const card = read('components/artwork-card.js');
  const image = read('components/artwork-image.js');
  const gallery = read('components/artwork-gallery.js');
  const styles = read('app/globals.css');

  assert.match(card, /hover=\{false\}/);
  assert.doesNotMatch(card, /artwork-image-hover/);
  assert.doesNotMatch(card, /scale\(/);
  assert.match(image, /hover = true/);
  assert.match(image, /object-contain/);
  assert.match(image, /hover \? ' artwork-image-hover'/);
  assert.doesNotMatch(gallery, /hover=\{false\}/);
  assert.match(styles, /\.artwork-image-frame[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /\.artwork-image-hover:hover\s*\{[^}]*transform:\s*scale\(1\.02\)/);
  assert.match(styles, /\.artwork-favourite-button:hover:not\(:disabled\) \.artwork-favourite-icon[\s\S]*transform:\s*scale/);
});

test('artwork detail gallery still uses physical fit on the stage and salon thumbs', () => {
  const gallery = read('components/artwork-gallery.js');
  const blocks = [...gallery.matchAll(/<ArtworkImage[\s\S]*?\/>/g)].map((match) => match[0]);
  const detailBlocks = blocks.filter((block) => /variant="detail"/.test(block));
  const lightboxBlocks = blocks.filter((block) => /variant="lightbox"/.test(block));
  const thumbBlocks = blocks.filter((block) => /sizes="120px"/.test(block));

  assert.equal(detailBlocks.length, 2);
  assert.equal(lightboxBlocks.length, 1);
  assert.equal(thumbBlocks.length, 1);
  assert.match(detailBlocks[0], /fit="physical"/);
  assert.match(detailBlocks[1], /fit="physical"/);
  assert.match(lightboxBlocks[0], /fit="physical"/);
  assert.doesNotMatch(thumbBlocks[0], /fit="physical"/);
  assert.doesNotMatch(thumbBlocks[0], /variant="detail"|variant="lightbox"/);
});
