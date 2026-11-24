import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  homepageFeaturedArtistPutBody,
  isArtistFeaturedOnHomepage,
} from '../lib/homepage-featured-artist.js';
import {
  artistExcerpt,
  artistFocusCopy,
  artistStoryHref,
  artistWorksHref,
  hydrateHomepageFeaturedArtist,
  selectHomepageArtists,
  shouldHydrateHomepageFeaturedArtist,
} from '../lib/homepage-artists.js';
import { selectHomepageArtworks } from '../lib/homepage-artworks.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('featured artist prefers a published portrait and is excluded from Artists to Know', () => {
  const { featured, known } = selectHomepageArtists([
    { id: 'draft-1', slug: 'hidden', name: 'Hidden', status: 'draft', profileImagePath: 'artists/x/portrait.jpg' },
    { id: 'a1', slug: 'rahul-subramaniam', name: 'Rahul Subramaniam', profileImagePath: null },
    { id: 'a2', slug: 'vishal-singh', name: 'Vishal Singh', profileImagePath: 'artists/v/portrait.jpg' },
    { id: 'a3', slug: 'third', name: 'Third', profileImagePath: 'artists/t/portrait.jpg' },
    { id: 'a4', slug: 'fourth', name: 'Fourth', profileImagePath: null },
  ]);

  assert.equal(featured.id, 'a2');
  assert.deepEqual(known.map((item) => item.id), ['a1', 'a3', 'a4']);
  assert.equal(known.some((item) => item.id === featured.id), false);
  assert.equal(known.some((item) => item.status === 'draft'), false);
});

test('draft artists never become the featured or known set', () => {
  const { featured, known } = selectHomepageArtists([
    { id: 'd1', slug: 'atelier', name: 'Verification Atelier', status: 'draft', profileImagePath: 'x' },
  ]);
  assert.equal(featured, null);
  assert.deepEqual(known, []);
});

test('manually featured published artist takes priority over automatic portrait selection', () => {
  const items = [
    { id: 'a1', slug: 'newest', name: 'Newest', profileImagePath: 'artists/a1/portrait.jpg' },
    { id: 'a2', slug: 'vishal-singh', name: 'Vishal Singh', profileImagePath: 'artists/a2/portrait.jpg' },
    { id: 'a3', slug: 'third', name: 'Third', profileImagePath: 'artists/a3/portrait.jpg' },
  ];
  const pinned = {
    id: 'a2',
    slug: 'vishal-singh',
    name: 'Vishal Singh',
    shortBio: 'A painter of quiet afternoons.',
    biography: 'There was once a meadow.',
    location: 'Goa',
    profileImagePath: 'artists/a2/portrait.jpg',
    profileImageAlt: 'Portrait of Vishal Singh',
  };
  const { featured, known } = selectHomepageArtists(items, { featuredArtist: pinned });
  assert.equal(featured.id, 'a2');
  assert.equal(featured.biography, 'There was once a meadow.');
  assert.deepEqual(known.map((item) => item.id), ['a1', 'a3']);
  assert.equal(known.some((item) => item.id === featured.id), false);
});

test('null featured setting uses existing automatic selection', () => {
  const items = [
    { id: 'a1', slug: 'rahul', name: 'Rahul', profileImagePath: null },
    { id: 'a2', slug: 'vishal', name: 'Vishal', profileImagePath: 'artists/v/portrait.jpg' },
  ];
  const automatic = selectHomepageArtists(items);
  const withNull = selectHomepageArtists(items, { featuredArtist: null });
  assert.equal(automatic.featured.id, 'a2');
  assert.equal(withNull.featured.id, automatic.featured.id);
  assert.deepEqual(withNull.known.map((item) => item.id), automatic.known.map((item) => item.id));
});

test('stale unpublished or deleted featured ids fall back to automatic selection', () => {
  const items = [
    { id: 'a1', slug: 'one', name: 'One', profileImagePath: 'artists/a1/portrait.jpg' },
    { id: 'a2', slug: 'two', name: 'Two', profileImagePath: 'artists/a2/portrait.jpg' },
    { id: 'draft-1', slug: 'hidden', name: 'Hidden', status: 'draft', profileImagePath: 'artists/d/portrait.jpg' },
  ];
  const missing = selectHomepageArtists(items, { featuredArtist: null });
  const unpublished = selectHomepageArtists(items, {
    featuredArtist: { id: 'draft-1', slug: 'hidden', name: 'Hidden', status: 'draft' },
  });
  assert.equal(missing.featured.id, 'a1');
  assert.equal(unpublished.featured.id, 'a1');
  assert.equal(missing.known.some((item) => item.id === 'draft-1'), false);
  assert.equal(unpublished.known.some((item) => item.id === 'draft-1'), false);
});

test('manually featured artist outside the first published page is still selected with biography', () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    id: `page-${index}`,
    slug: `page-${index}`,
    name: `Page ${index}`,
    profileImagePath: `artists/page-${index}/portrait.jpg`,
  }));
  const pinned = {
    id: 'outside-100',
    slug: 'atelier-beyond',
    name: 'Atelier Beyond',
    shortBio: 'A painter of quiet afternoons.',
    biography: 'There was once a meadow. Light fell across the grass.',
    location: 'Goa',
    profileImagePath: 'artists/outside/portrait.jpg',
    profileImageAlt: 'Portrait of Atelier Beyond',
  };
  const { featured, known } = selectHomepageArtists(items, { featuredArtist: pinned });
  assert.equal(featured.id, 'outside-100');
  assert.equal(featured.biography, pinned.biography);
  assert.equal(featured.shortBio, pinned.shortBio);
  assert.equal(featured.location, 'Goa');
  assert.equal(items.some((item) => item.id === featured.id), false);
  assert.equal(known.some((item) => item.id === featured.id), false);
  assert.deepEqual(known.map((item) => item.id), ['page-0', 'page-1', 'page-2']);
  const copy = artistFocusCopy(featured);
  assert.equal(copy.headline, pinned.shortBio);
  assert.match(copy.body, /There was once a meadow/);
});

test('fewer than three published artists render without placeholders', () => {
  const { featured, known } = selectHomepageArtists([
    { id: 'a1', slug: 'one', name: 'One', profileImagePath: 'p.jpg' },
    { id: 'a2', slug: 'two', name: 'Two' },
  ]);
  assert.equal(featured.id, 'a1');
  assert.equal(known.length, 1);
  assert.equal(known[0].id, 'a2');
});

test('focus copy uses short bio and biography without inventing quotations', () => {
  const copy = artistFocusCopy({
    name: 'Vishal Singh',
    shortBio: 'A painter of quiet afternoons.',
    biography: 'There was once a meadow. **Light** fell across the grass. More archive notes follow.',
  });
  assert.equal(copy.headline, 'A painter of quiet afternoons.');
  assert.match(copy.body, /There was once a meadow/);
  assert.doesNotMatch(copy.body, /\*\*/);
  assert.equal(artistFocusCopy({ name: 'Rahul Subramaniam' }).headline, null);
  assert.equal(artistExcerpt(''), '');
});

test('artist homepage links point at profile works and story anchors', () => {
  const artist = { slug: 'vishal-singh' };
  assert.equal(artistWorksHref(artist), '/artists/vishal-singh#works');
  assert.equal(artistStoryHref(artist), '/artists/vishal-singh#story');
});

test('homepage catalogue prefers featured lots then fills remaining slots from published works', () => {
  const selected = selectHomepageArtworks(
    [{ id: 'featured', title: 'A Moment of Innocence', isFeatured: true }],
    [
      { id: 'latest', title: 'Lotus in Moonlight', isFeatured: false },
      { id: 'featured', title: 'A Moment of Innocence', isFeatured: true },
    ],
    { limit: 8 },
  );
  assert.deepEqual(selected.map((item) => item.id), ['featured', 'latest']);
});

test('an older featured lot still leads the homepage when it is absent from the latest eight', () => {
  const featured = [{ id: 'old-featured', title: 'Archival hanging', isFeatured: true }];
  const latest = Array.from({ length: 8 }, (_, index) => ({
    id: `new-${index}`,
    title: `New ${index}`,
    isFeatured: false,
  }));
  const selected = selectHomepageArtworks(featured, latest, { limit: 8 });
  assert.equal(selected[0].id, 'old-featured');
  assert.equal(selected.length, 8);
  assert.deepEqual(
    selected.slice(1).map((item) => item.id),
    ['new-0', 'new-1', 'new-2', 'new-3', 'new-4', 'new-5', 'new-6'],
  );
  assert.equal(selected.some((item) => item.id === 'new-7'), false);
});

test('enabling a new artist replaces the pin and disabling a non-featured artist does not clear it', () => {
  assert.deepEqual(
    homepageFeaturedArtistPutBody({
      artistId: 'a2',
      featuredArtistId: 'a1',
      enabled: true,
    }),
    { artistId: 'a2' },
  );
  assert.deepEqual(
    homepageFeaturedArtistPutBody({
      artistId: 'a1',
      featuredArtistId: 'a1',
      enabled: false,
    }),
    { artistId: null },
  );
  assert.equal(
    homepageFeaturedArtistPutBody({
      artistId: 'a2',
      featuredArtistId: 'a1',
      enabled: false,
    }),
    null,
  );
  assert.equal(isArtistFeaturedOnHomepage('a1', 'a1'), true);
  assert.equal(isArtistFeaturedOnHomepage('a2', 'a1'), false);
});

test('manually pinned artist does not trigger an extra detail request', async () => {
  const pinned = {
    id: 'a2',
    slug: 'vishal-singh',
    name: 'Vishal Singh',
    biography: 'There was once a meadow.',
  };
  let calls = 0;
  const result = await hydrateHomepageFeaturedArtist(pinned, pinned, async () => {
    calls += 1;
    return { ...pinned, biography: 'other' };
  });
  assert.equal(shouldHydrateHomepageFeaturedArtist(pinned, pinned), false);
  assert.equal(calls, 0);
  assert.equal(result.biography, 'There was once a meadow.');
});

test('automatic fallback fetches the selected artist biography and keeps list data on failure', async () => {
  const featured = {
    id: 'a2',
    slug: 'vishal-singh',
    name: 'Vishal Singh',
    shortBio: 'A painter of quiet afternoons.',
    profileImagePath: 'artists/v/portrait.jpg',
  };
  const items = [
    featured,
    { id: 'a3', slug: 'third', name: 'Third', profileImagePath: 'artists/t/portrait.jpg' },
  ];
  const selected = selectHomepageArtists(items);
  assert.equal(selected.featured.id, 'a2');
  assert.deepEqual(selected.known.map((item) => item.id), ['a3']);
  assert.equal(shouldHydrateHomepageFeaturedArtist(selected.featured, null), true);

  const hydrated = await hydrateHomepageFeaturedArtist(selected.featured, null, async (slug) => {
    assert.equal(slug, 'vishal-singh');
    return {
      ...featured,
      biography: 'There was once a meadow. Light fell across the grass.',
    };
  });
  assert.equal(hydrated.biography, 'There was once a meadow. Light fell across the grass.');
  assert.match(artistFocusCopy(hydrated).body, /There was once a meadow/);

  const failed = await hydrateHomepageFeaturedArtist(selected.featured, null, async () => {
    throw new Error('artist detail unavailable');
  });
  assert.equal(failed, selected.featured);
  assert.equal(failed.biography, undefined);
});

test('no featured artist skips the detail request', async () => {
  let calls = 0;
  const result = await hydrateHomepageFeaturedArtist(null, null, async () => {
    calls += 1;
    return { id: 'x' };
  });
  assert.equal(shouldHydrateHomepageFeaturedArtist(null, null), false);
  assert.equal(calls, 0);
  assert.equal(result, null);
});

test('homepage fetches published artists once and renders both editorial sections', () => {
  const page = read('app/(gallery)/(salon)/page.js');
  const loaders = read('lib/gallery-entity-loaders.js');
  const focus = read('components/artist-in-focus.js');
  assert.match(page, /listArtists\(\{ limit: 8 \}\)/);
  assert.match(page, /selectHomepageArtists/);
  assert.match(page, /featuredArtist: pinnedArtist/);
  assert.match(page, /loadHomepageFeaturedArtist\(\)/);
  assert.match(page, /hydrateHomepageFeaturedArtist/);
  assert.match(page, /loadArtistBySlug/);
  assert.match(page, /selectHomepageArtworks/);
  assert.match(page, /<ArtistInFocus artist=\{featuredArtist\}/);
  assert.match(page, /ArtistsToKnow/);
  assert.match(page, /listArtworks\(\{ featured: 'true', limit: 8 \}\)/);
  assert.match(page, /listArtworks\(\{ limit: 8 \}\)/);
  assert.doesNotMatch(page, /listArtists\(\{ limit: 100 \}\)/);
  assert.doesNotMatch(page, /api\.getArtist/);
  assert.doesNotMatch(page, /Elena|Lila|quotation|Lorem|sample artist/i);
  assert.match(focus, /artistFocusCopy\(artist\)/);
  assert.match(loaders, /export const loadHomepageFeaturedArtist = cache\(/);
  assert.match(loaders, /export const loadArtistBySlug = cache\(/);
  assert.match(loaders, /getHomepageFeaturedArtist/);
  assert.match(loaders, /data\?\.artist/);
  assert.doesNotMatch(loaders, /unstable_cache|revalidate/);
});

test('editorial sections match the split-screen and three-column structure', () => {
  const focus = read('components/artist-in-focus.js');
  const know = read('components/artists-to-know.js');
  const helpers = read('lib/homepage-artists.js');
  const links = read('components/artist-editorial-links.js');
  assert.match(focus, /lg:grid-cols-2/);
  assert.match(focus, /bg-olive/);
  assert.match(focus, /Artist in Focus/);
  assert.match(focus, /artist-in-focus-frame/);
  assert.match(focus, /object-cover/);
  assert.doesNotMatch(focus, /min-h-\[42rem\]|min-h-\[32rem\]/);
  const css = read('app/globals.css');
  assert.match(css, /\.artist-in-focus-frame[\s\S]*height:\s*40rem/);
  assert.match(css, /\.artist-in-focus-portrait[\s\S]*height:\s*22rem/);
  assert.match(links, /Explore artist's works/);
  assert.match(know, /lg:grid-cols-3/);
  assert.match(know, /Artists to know/);
  assert.match(know, /Meet the hands behind the work/);
  assert.match(know, /from-charcoal\/90/);
  assert.match(helpers, /#works/);
  assert.match(helpers, /#story/);
  assert.doesNotMatch(focus, /rounded-|shadow-|border /);
});

test('artist profile exposes story and works anchors for homepage links', () => {
  const detail = read('app/(gallery)/artists/[slug]/page.js');
  const profile = read('components/artist-profile.js');
  assert.match(detail, /ArtistProfile/);
  assert.match(profile, /id="story"/);
  assert.match(profile, /id="works"/);
});
