import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADMIN_NAV_LINKS } from '../lib/admin-nav.js';
import { artistPortraitStoragePath, isArtistPortraitPath } from '../lib/artist-portrait.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('customer navigation includes Artists at /artists', () => {
  const header = read('components/site-header.js');
  const mobile = read('components/mobile-nav.js');
  const footer = read('components/site-footer.js');
  for (const source of [header, mobile, footer]) {
    assert.match(source, /href: '\/artists'|href="\/artists"/);
    assert.match(source, /Artists/);
  }
});

test('admin navigation includes Artists at /admin/artists', () => {
  assert.equal(
    ADMIN_NAV_LINKS.some((link) => link.href === '/admin/artists' && link.label === 'Artists'),
    true,
  );
});

test('artists listing and detail pages set metadata, canonical URLs and portrait Open Graph', () => {
  const listing = read('app/(gallery)/artists/page.js');
  const detail = read('app/(gallery)/artists/[slug]/page.js');
  assert.match(listing, /title: 'Artists'/);
  assert.match(listing, /canonicalFor\('\/artists'\)/);
  assert.match(listing, /openGraph/);
  assert.match(detail, /generateMetadata/);
  assert.match(detail, /canonicalFor\(`\/artists\/\$\{slug\}`\)/);
  assert.match(detail, /openGraph/);
  assert.match(detail, /portraitUrl/);
  assert.match(detail, /type: 'profile'/);
  assert.match(detail, /notFound\(\)/);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'app/(gallery)/artists/[slug]/not-found.js')), true);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'app/(gallery)/artists/loading.js')), true);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'app/(gallery)/artists/[slug]/loading.js')), true);
});

test('artist detail lists published artworks and preserves story and works anchors', () => {
  const detail = read('app/(gallery)/artists/[slug]/page.js');
  const profile = read('components/artist-profile.js');
  const card = read('components/artwork-card.js');
  assert.match(detail, /ArtistProfile/);
  assert.match(detail, /listArtists/);
  assert.match(profile, /artist\.artworks/);
  assert.match(profile, /href=\{`\/artwork\/\$\{artwork\.id\}`\}/);
  assert.match(profile, /id="story"/);
  assert.match(profile, /id="works"/);
  assert.match(profile, /The story behind the work/);
  assert.match(profile, /Selected works/);
  assert.match(profile, /Discover more original art/);
  assert.doesNotMatch(profile, /Born 1986|Meera Sen-Gupta|Devendra Varma|Ananya Ghosh|VÉRITÉ|#VER-ATELIER/);
  assert.match(card, /href=\{`\/artwork\/\$\{artwork\.id\}`\}/);
});

test('artwork detail links associated artists to /artists/{slug}', () => {
  const detail = read('app/(gallery)/artwork/[id]/page.js');
  assert.match(detail, /artwork\.artist\?\.slug/);
  assert.match(detail, /href=\{`\/artists\/\$\{artwork\.artist\.slug\}`\}/);
});

test('admin artwork form uses an artist selector instead of free-text attribution', () => {
  const form = read('components/artwork-form.js');
  assert.match(form, /name="artistId"/);
  assert.match(form, /Select a published artist/);
  assert.doesNotMatch(form, /name="artistName"/);
});

test('portrait upload uses the artwork-images artists/{artistId}/portrait.{ext} prefix', () => {
  const artistId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.equal(artistPortraitStoragePath(artistId, 'hero.WEBP'), `artists/${artistId}/portrait.webp`);
  assert.equal(isArtistPortraitPath(artistId, `artists/${artistId}/portrait.webp`), true);
  assert.equal(isArtistPortraitPath(artistId, `${artistId}/hero.webp`), false);
  const form = read('components/artist-form.js');
  const upload = read('lib/artwork-image-upload.js');
  assert.match(form, /artistPortraitStoragePath/);
  assert.match(form, /uploadArtworkImageFile/);
  assert.match(upload, /ARTWORK_IMAGES_BUCKET/);
  assert.doesNotMatch(form, /service_role|SERVICE_ROLE/);
  assert.doesNotMatch(read('lib/artist-portrait.js'), /service_role|SERVICE_ROLE/);
});

test('admin artist screens exist for list, create and edit', () => {
  assert.equal(fs.existsSync(path.join(frontendRoot, 'app/admin/artists/page.js')), true);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'app/admin/artists/new/page.js')), true);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'app/admin/artists/[id]/edit/page.js')), true);
  const form = read('components/artist-form.js');
  assert.match(form, /Save draft/);
  assert.match(form, /Publish/);
  assert.match(form, /Unpublish/);
  assert.match(form, /Delete this artist permanently/);
  assert.match(form, /Associated artworks/);
});
