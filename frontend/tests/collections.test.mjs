import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADMIN_NAV_LINKS } from '../lib/admin-nav.js';
import {
  collectionCoverStoragePath,
  collectionCoverUrl,
  isCollectionCoverPath,
} from '../lib/collection-cover.js';
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
  assert.match(header, /whitespace-nowrap/);
  assert.match(header, /hidden xl:flex/);
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
  const uniqueId = '11111111-1111-4111-8111-111111111111';
  assert.equal(
    collectionCoverStoragePath(collectionId, 'hero.WEBP', uniqueId),
    `collections/${collectionId}/cover-${uniqueId}.webp`,
  );
  assert.match(
    collectionCoverStoragePath(collectionId, 'hero.PNG'),
    new RegExp(`^collections/${collectionId}/cover-[0-9a-f-]+\\.png$`),
  );
  assert.equal(isCollectionCoverPath(collectionId, `collections/${collectionId}/cover.webp`), true);
  assert.equal(
    isCollectionCoverPath(collectionId, `collections/${collectionId}/cover-${uniqueId}.webp`),
    true,
  );
  const publicUrl = (storagePath) => `https://example.supabase.co/storage/v1/object/public/artwork-images/${storagePath}`;
  const coverUrl = collectionCoverUrl(
    `collections/${collectionId}/cover.webp`,
    '2026-11-24T12:00:00.000Z',
    { publicUrl },
  );
  assert.match(coverUrl, /\/collections\/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb\/cover\.webp/);
  assert.match(coverUrl, /v=2026-11-24T12%3A00%3A00\.000Z/);
  const later = collectionCoverUrl(
    `collections/${collectionId}/cover.webp`,
    '2026-11-25T12:00:00.000Z',
    { publicUrl },
  );
  assert.notEqual(coverUrl, later);
  const form = read('components/collection-form.js');
  const upload = read('lib/artwork-image-upload.js');
  assert.match(form, /collectionCoverStoragePath/);
  assert.match(form, /uploadArtworkImageFile/);
  assert.match(form, /useArtworkImageConstraints/);
  assert.match(form, /retryConstraints/);
  assert.match(form, /coverImagePath: path/);
  assert.match(form, /key=\{\`\$\{coverPath \|\| 'none'\}::\$\{coverUpdatedAt \|\| 'new'\}`\}/);
  assert.match(form, /hadPendingCover \? nextCoverPath/);
  assert.match(form, /mode !== 'edit' \|\| savedId !== current\.id/);
  assert.match(upload, /ARTWORK_IMAGES_BUCKET/);
  assert.match(read('lib/api-client.js'), /cache:\s*'no-store'/);
  assert.doesNotMatch(read('lib/collection-cover.js'), /service_role|SERVICE_ROLE/);
  assert.doesNotMatch(read('components/collection-cover-upload.js'), /service_role|SERVICE_ROLE/);
});

test('public listing renders a cover image or fallback and drops catalogue copy', () => {
  const listing = read('app/(gallery)/collections/page.js');
  assert.match(listing, /collectionCoverUrl\(collection\.coverImagePath, collection\.updatedAt\)/);
  assert.match(listing, /ImagePlaceholder|No cover/);
  assert.match(listing, /href=\{`\/collections\/\$\{collection\.id\}`\}/);
  assert.match(listing, /editorial-image-hover/);
  assert.match(listing, /editorial-card-link/);
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
  assert.match(detail, /editorial-image-hover/);
  assert.match(detail, /collectionCoverUrl\(collection\.coverImagePath, collection\.updatedAt\)/);
  assert.match(detail, /sortByCollectionOrder\(list\.items \|\| \[\], collection\.artworkIds\)/);
  assert.doesNotMatch(detail, /createdAt/);
  assert.doesNotMatch(detail, /Cover catalogued/);
});

test('homepage taxonomy and Explore keep collectionId links working', () => {
  const homepage = read('app/(gallery)/(salon)/page.js');
  const showcase = read('components/homepage-collection-showcase.js');
  const explore = read('app/(gallery)/explore/page.js');
  const taxonomyIndex = homepage.indexOf('Taxonomy of form');
  const headingIndex = homepage.indexOf('Explore by medium');
  const showcaseIndex = homepage.indexOf('<HomepageCollectionShowcase collections={collections} />');
  const faqIndex = homepage.indexOf('<HomepageFaq faq={faq} />');
  assert.match(homepage, /listCollections/);
  assert.match(homepage, /<HomepageCollectionShowcase collections=\{collections\} \/>/);
  assert.ok(taxonomyIndex > 0 && taxonomyIndex < headingIndex);
  assert.ok(headingIndex > 0 && headingIndex < showcaseIndex);
  assert.ok(showcaseIndex > 0 && showcaseIndex < faqIndex);
  assert.doesNotMatch(homepage, /Curated hangings/);
  assert.doesNotMatch(homepage, /api\.listCollections\(\)[\s\S]*api\.listCollections/);
  assert.match(showcase, /href=\{`\/collections\/\$\{collection\.id\}`\}/);
  assert.match(showcase, /collectionCoverUrl\(collection\.coverImagePath, collection\.updatedAt\)/);
  assert.match(showcase, /src=\{coverUrl\}/);
  assert.match(showcase, /Explore collection \$\{collection\.name\}/);
  assert.match(showcase, /Explore Collection/);
  assert.match(showcase, /homepage-collection-panel/);
  assert.match(showcase, /homepage-collection-title/);
  assert.match(showcase, /homepage-collection-description/);
  assert.match(showcase, /homepage-collection-cta/);
  assert.doesNotMatch(showcase, /'use client'/);
  assert.doesNotMatch(showcase, /listCollections|fetch\(/);
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

test('homepage collection showcase overlays copy, clips hover zoom and keeps CTA on touch', () => {
  const homepage = read('app/(gallery)/(salon)/page.js');
  const showcase = read('components/homepage-collection-showcase.js');
  const listing = read('app/(gallery)/collections/page.js');
  const styles = read('app/globals.css');

  const taxonomyIndex = homepage.indexOf('Taxonomy of form');
  const headingIndex = homepage.indexOf('Explore by medium');
  const showcaseIndex = homepage.indexOf('<HomepageCollectionShowcase collections={collections} />');
  assert.match(homepage, /listCollections/);
  assert.match(homepage, /<HomepageCollectionShowcase collections=\{collections\} \/>/);
  assert.equal((homepage.match(/Taxonomy of form/g) || []).length, 1);
  assert.equal((homepage.match(/Explore by medium/g) || []).length, 1);
  assert.ok(taxonomyIndex > 0 && taxonomyIndex < headingIndex && headingIndex < showcaseIndex);
  assert.doesNotMatch(homepage, /Curated hangings/);
  assert.doesNotMatch(homepage, /<HomepageCollectionShowcase[\s\S]*<section/);
  assert.doesNotMatch(homepage, /unstable_cache|revalidate/);
  assert.match(showcase, /items\.map\(\(collection\)/);
  assert.match(showcase, /href=\{`\/collections\/\$\{collection\.id\}`\}/);
  assert.match(showcase, /View the published hanging/);
  assert.match(showcase, /aria-label=\{`Explore collection \$\{collection\.name\}`\}/);
  assert.doesNotMatch(showcase, /Curated hangings/);
  assert.doesNotMatch(showcase, /<h2[\s\S]*Collections/);
  assert.doesNotMatch(showcase, /<section/);
  assert.doesNotMatch(showcase, /from '\.\/reveal'|from '@\/components\/reveal'/);
  assert.match(styles, /\.homepage-collection-panel[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\)[\s\S]*\.homepage-collection-panel:hover \.homepage-collection-media img[\s\S]*scale\(1\.03\)/);
  assert.match(styles, /@media \(hover: hover\)[\s\S]*\.homepage-collection-cta[\s\S]*opacity:\s*0/);
  assert.match(styles, /\.homepage-collection-cta \{[\s\S]*opacity:\s*1/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*\.homepage-collection-cta[\s\S]*opacity:\s*1/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*\.homepage-collection-panel:hover \.homepage-collection-media img[\s\S]*transform:\s*none/);
  assert.match(styles, /\.homepage-collection-panel:focus-visible/);
  assert.doesNotMatch(styles, /@keyframes\s+shimmer/i);
  assert.doesNotMatch(listing, /homepage-collection-panel/);
  assert.match(listing, /editorial-card-link/);
  assert.match(listing, /View the hanging/);
});

test('artwork form does not send collectionIds when membership is unchanged or the list is empty', () => {
  const form = read('components/artwork-form.js');
  assert.match(form, /collectionMembershipUnchanged/);
  assert.match(form, /shouldWriteCollections/);
  assert.match(form, /collections\.length > 0 && !collectionMembershipUnchanged/);
  assert.match(form, /body\.collectionIds = collectionIds/);
});
