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

test('page-shell is the shared full-width gutter without a 7xl cap', () => {
  const css = read('app/globals.css');
  assert.match(css, /\.page-shell\s*\{[\s\S]*?width:\s*100%/);
  assert.doesNotMatch(css, /\.page-shell\s*\{[\s\S]*?max-width:\s*80rem/);
  const header = read('components/site-header.js');
  const footer = read('components/site-footer.js');
  const intro = read('components/ui.js');
  assert.match(header, /page-shell/);
  assert.match(footer, /page-shell/);
  assert.match(intro, /page-shell/);
  assert.doesNotMatch(header, /max-w-7xl/);
  assert.doesNotMatch(footer, /max-w-7xl/);
  assert.doesNotMatch(intro, /max-w-7xl/);
});

test('PageIntro uses a complementary heading and copy column on desktop', () => {
  const intro = read('components/ui.js');
  assert.match(intro, /lg:grid-cols-12/);
  assert.match(intro, /lg:col-span-5/);
  assert.match(intro, /lg:col-span-7/);
});

test('about, contact and sign-in stack a centered column instead of a two-column intro', () => {
  const login = read('app/(gallery)/auth/login/page.js');
  const about = read('app/(gallery)/about/page.js');
  const contact = read('app/(gallery)/contact/page.js');
  for (const source of [login, about, contact]) {
    assert.match(source, /page-shell/);
    assert.doesNotMatch(source, /PageIntro/);
    assert.doesNotMatch(source, /lg:grid-cols-12|md:grid-cols-2/);
  }
  assert.doesNotMatch(about, /max-w-4xl/);
  assert.match(contact, /mailto:atelier@maisondart\.example/);
  assert.doesNotMatch(contact, /max-w-4xl/);
  assert.match(login, /mx-auto/);
  assert.match(login, /max-w-xl/);
  assert.match(login, /LoginButton/);
});

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
    'app/(gallery)/journal/loading.js',
    'app/(gallery)/journal/[slug]/loading.js',
    'app/(gallery)/artists/loading.js',
    'app/(gallery)/artists/[slug]/loading.js',
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
    'app/admin/blogs/loading.js',
    'app/admin/blogs/new/loading.js',
    'app/admin/blogs/[id]/edit/loading.js',
    'app/admin/artists/loading.js',
    'app/admin/artists/new/loading.js',
    'app/admin/artists/[id]/edit/loading.js',
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
