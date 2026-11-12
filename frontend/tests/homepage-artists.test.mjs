import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  artistExcerpt,
  artistFocusCopy,
  artistStoryHref,
  artistWorksHref,
  selectHomepageArtists,
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

test('homepage fetches published artists once and renders both editorial sections', () => {
  const page = read('app/(gallery)/(salon)/page.js');
  assert.match(page, /listArtists/);
  assert.match(page, /selectHomepageArtists/);
  assert.match(page, /selectHomepageArtworks/);
  assert.match(page, /ArtistInFocus/);
  assert.match(page, /ArtistsToKnow/);
  assert.match(page, /getArtist\(featured\.slug\)/);
  assert.doesNotMatch(page, /Elena|Lila|quotation|Lorem|sample artist/i);
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
  assert.match(detail, /id="story"/);
  assert.match(detail, /id="works"/);
});
