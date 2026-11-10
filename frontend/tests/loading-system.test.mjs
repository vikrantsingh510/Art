import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(frontendRoot, relativePath));
}

test('quiet luxury loading tokens exist without shimmer or spinner CSS', () => {
  const css = read('app/globals.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.skeleton-block/);
  assert.match(css, /\.page-enter/);
  assert.match(css, /\.artwork-image-fade/);
  assert.doesNotMatch(css, /@keyframes\s+shimmer/i);
  assert.doesNotMatch(css, /animate-spin/);
});

test('route loading coverage is in place for data-heavy salon and console pages', () => {
  const files = [
    'app/(gallery)/loading.js',
    'app/(gallery)/(salon)/loading.js',
    'app/(gallery)/explore/loading.js',
    'app/(gallery)/explore/layout.js',
    'app/(gallery)/artwork/[id]/loading.js',
    'app/(gallery)/collections/loading.js',
    'app/(gallery)/collections/[id]/loading.js',
    'app/(gallery)/account/loading.js',
    'app/(gallery)/account/orders/loading.js',
    'app/(gallery)/account/wishlist/loading.js',
    'app/(gallery)/cart/loading.js',
    'app/(gallery)/checkout/loading.js',
    'app/admin/loading.js',
    'app/admin/(dashboard)/loading.js',
    'app/admin/artworks/loading.js',
    'app/admin/artworks/new/loading.js',
    'app/admin/artworks/[id]/edit/loading.js',
    'app/admin/orders/loading.js',
    'app/admin/customers/loading.js',
    'components/loading.js',
    'components/page-transition.js',
  ];
  files.forEach((file) => {
    assert.equal(exists(file), true, `missing ${file}`);
  });
});

test('static editorial pages do not add local loading.js files', () => {
  ['about', 'contact', 'privacy', 'terms', 'forbidden'].forEach((route) => {
    assert.equal(exists(`app/(gallery)/${route}/loading.js`), false);
  });
});
