import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADMIN_NAV_LINKS } from '../lib/admin-nav.js';
import { collectionCoverStoragePath, isCollectionCoverPath } from '../lib/collection-cover.js';
import { clearedExploreQuery, exploreHref, parseExploreQuery } from '../lib/explore-query.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('customer navigation includes Collections at /collections', () => {
  const header = read('components/site-header.js');
  const mobile = read('components/mobile-nav.js');
  const footer = read('components/site-footer.js');
  for (const source of [header, mobile, footer]) {
    assert.match(source, /href: '\/collections'|href="\/collections"/);
    assert.match(source, /Collections/);
  }
});

test('admin navigation lists Collections separately from Artwork collection', () => {
  assert.equal(
    ADMIN_NAV_LINKS.some((link) => link.href === '/admin/collections' && link.label === 'Collections'),
    true,
  );
  assert.equal(
    ADMIN_NAV_LINKS.some((link) => link.href === '/admin/artworks' && link.label === 'Artwork collection'),
    true,
  );
  assert.equal(
    ADMIN_NAV_LINKS.filter((link) => link.label === 'Collections').length,
    1,
  );
});

test('admin collection listing, create and edit screens render the hanging workflow', () => {
  const listing = read('app/admin/collections/page.js');
  const createPage = read('app/admin/collections/new/page.js');
  const editPage = read('app/admin/collections/[id]/edit/page.js');
  const form = read('components/collection-form.js');
  const picker = read('components/collection-artwork-picker.js');

  assert.match(listing, /Create collection/);
  assert.match(listing, /No collections yet/);
  assert.match(listing, /ErrorState/);
  assert.match(listing, /isPublished \? 'Published' : 'Draft'/);
  assert.match(listing, /artworkCount/);
  assert.match(listing, /formatDate\(collection\.updatedAt\)/);
  assert.match(listing, /\/admin\/collections\/\$\{collection\.id\}\/edit/);

  assert.match(createPage, /CollectionForm/);
  assert.match(createPage, /mode="create"/);
  assert.match(editPage, /adminCollection/);
  assert.match(editPage, /mode="edit"/);

  assert.match(form, /Save collection/);
  assert.match(form, /Save and publish/);
  assert.match(form, /Cancel/);
  assert.match(form, /replaceCollectionArtworks/);
  assert.match(form, /collectionCoverStoragePath/);
  assert.match(form, /uploadArtworkImageFile/);
  assert.doesNotMatch(form, /service_role|SERVICE_ROLE/);

  assert.match(picker, /adminArtworks/);
  assert.match(picker, /Order \{index \+ 1\}/);
  assert.match(picker, /Up/);
  assert.match(picker, /Down/);
  assert.match(picker, /Remove/);
});

test('empty admin collection state offers Create collection', () => {
  const listing = read('app/admin/collections/page.js');
  assert.match(listing, /collections\.length === 0/);
  assert.match(listing, /Create collection/);
  assert.match(listing, /EmptyState/);
});

test('cover upload uses the artwork-images collections/{collectionId}/cover.{ext} prefix', () => {
  const collectionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.equal(collectionCoverStoragePath(collectionId, 'hero.WEBP'), `collections/${collectionId}/cover.webp`);
  assert.equal(isCollectionCoverPath(collectionId, `collections/${collectionId}/cover.webp`), true);
  const form = read('components/collection-form.js');
  const upload = read('lib/artwork-image-upload.js');
  assert.match(form, /collectionCoverStoragePath/);
  assert.match(form, /uploadArtworkImageFile/);
  assert.match(upload, /ARTWORK_IMAGES_BUCKET/);
  assert.doesNotMatch(read('lib/collection-cover.js'), /service_role|SERVICE_ROLE/);
  assert.doesNotMatch(read('components/collection-cover-upload.js'), /service_role|SERVICE_ROLE/);
});

test('public listing renders a cover image or fallback and drops catalogue copy', () => {
  const listing = read('app/(gallery)/collections/page.js');
  assert.match(listing, /publicStorageUrl\(collection\.coverImagePath\)/);
  assert.match(listing, /ImagePlaceholder|No cover/);
  assert.match(listing, /href=\{`\/collections\/\$\{collection\.id\}`\}/);
  assert.doesNotMatch(listing, /Cover catalogued/);
  assert.match(listing, /listCollections/);
  assert.match(listing, /EmptyState/);
  assert.match(listing, /ErrorState/);
});

test('public detail renders published artworks in hanging order', () => {
  const detail = read('app/(gallery)/collections/[id]/page.js');
  assert.match(detail, /loadCollectionById/);
  assert.match(detail, /listArtworks\(\{ collectionId: id, limit: 100 \}\)/);
  assert.match(detail, /sortByCollectionOrder/);
  assert.match(detail, /collection\.artworkIds/);
  assert.match(detail, /This hanging has no published works yet\./);
  assert.match(detail, /notFound\(\)/);
  assert.match(detail, /ArtworkCard/);
  assert.doesNotMatch(detail, /createdAt/);
  assert.doesNotMatch(detail, /Cover catalogued/);
});

test('homepage taxonomy and Explore keep collectionId links working', () => {
  const homepage = read('app/(gallery)/(salon)/page.js');
  const explore = read('app/(gallery)/explore/page.js');
  assert.match(homepage, /listCollections/);
  assert.match(homepage, /href=\{`\/collections\/\$\{collection\.id\}`\}/);
  assert.match(explore, /collectionId: params.collectionId/);
  assert.match(explore, /listArtworks/);

  const parsed = parseExploreQuery({
    q: 'ochre',
    collectionId: '11111111-1111-4111-8111-111111111111',
    categoryId: '22222222-2222-4222-8222-222222222222',
  });
  assert.equal(parsed.collectionId, '11111111-1111-4111-8111-111111111111');
  assert.match(
    exploreHref(parsed, parsed.page),
    /collectionId=11111111-1111-4111-8111-111111111111/,
  );
  assert.equal(clearedExploreQuery(parsed).collectionId, '');
});

test('artwork form does not send collectionIds when membership is unchanged or the list is empty', () => {
  const form = read('components/artwork-form.js');
  assert.match(form, /collectionMembershipUnchanged/);
  assert.match(form, /shouldWriteCollections/);
  assert.match(form, /collections\.length > 0 && !collectionMembershipUnchanged/);
  assert.match(form, /body\.collectionIds = collectionIds/);
});
