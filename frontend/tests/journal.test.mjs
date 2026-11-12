import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADMIN_NAV_LINKS } from '../lib/admin-nav.js';
import { blogCoverStoragePath, isBlogCoverPath } from '../lib/blog-cover.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('customer navigation includes Journal at /journal', () => {
  const header = read('components/site-header.js');
  const mobile = read('components/mobile-nav.js');
  const footer = read('components/site-footer.js');
  for (const source of [header, mobile, footer]) {
    assert.match(source, /href: '\/journal'|href="\/journal"/);
    assert.match(source, /Journal/);
  }
});

test('admin navigation includes Journal at /admin/blogs', () => {
  assert.equal(
    ADMIN_NAV_LINKS.some((link) => link.href === '/admin/blogs' && link.label === 'Journal'),
    true,
  );
});

test('journal listing and detail pages set metadata, canonical URLs and cover Open Graph', () => {
  const listing = read('app/(gallery)/journal/page.js');
  const detail = read('app/(gallery)/journal/[slug]/page.js');
  assert.match(listing, /title: 'Journal'/);
  assert.match(listing, /journalCanonical\('\/journal'\)/);
  assert.match(listing, /openGraph/);
  assert.match(detail, /generateMetadata/);
  assert.match(detail, /journalCanonical\(`\/journal\/\$\{slug\}`\)/);
  assert.match(detail, /openGraph/);
  assert.match(detail, /coverUrl/);
  assert.match(detail, /type: 'article'/);
  assert.match(detail, /notFound\(\)/);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'app/(gallery)/journal/[slug]/not-found.js')), true);
});

test('journal detail links related artworks to /artwork/{id}', () => {
  const detail = read('app/(gallery)/journal/[slug]/page.js');
  const card = read('components/artwork-card.js');
  assert.match(detail, /ArtworkCard/);
  assert.match(detail, /blog\.artworks/);
  assert.match(card, /href=\{`\/artwork\/\$\{artwork\.id\}`\}/);
});

test('cover upload uses the artwork-images blogs/{blogId}/cover.{ext} prefix', () => {
  const blogId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.equal(blogCoverStoragePath(blogId, 'hero.WEBP'), `blogs/${blogId}/cover.webp`);
  assert.equal(isBlogCoverPath(blogId, `blogs/${blogId}/cover.webp`), true);
  const form = read('components/blog-form.js');
  const upload = read('lib/artwork-image-upload.js');
  assert.match(form, /blogCoverStoragePath/);
  assert.match(form, /uploadArtworkImageFile/);
  assert.match(upload, /ARTWORK_IMAGES_BUCKET/);
  assert.doesNotMatch(form, /service_role|SERVICE_ROLE/);
  assert.doesNotMatch(read('lib/blog-cover.js'), /service_role|SERVICE_ROLE/);
});
