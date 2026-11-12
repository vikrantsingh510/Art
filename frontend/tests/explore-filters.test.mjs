import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PRICE_BANDS,
  clearedExploreQuery,
  exploreFilterChips,
  exploreHasActiveFilters,
  exploreHref,
  parseExploreQuery,
  priceBandLabel,
} from '../lib/explore-query.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('explore query keeps search, category and valuation and ignores empty values', () => {
  const parsed = parseExploreQuery({
    q: 'ochre',
    categoryId: '11111111-1111-4111-8111-111111111111',
    minPricePaise: '10000000',
    maxPricePaise: '30000000',
    page: '2',
  });
  assert.equal(parsed.q, 'ochre');
  assert.equal(parsed.limit, '18');
  assert.equal(
    exploreHref(parsed, parsed.page),
    '/explore?q=ochre&categoryId=11111111-1111-4111-8111-111111111111&minPricePaise=10000000&maxPricePaise=30000000&page=2&limit=18',
  );
  assert.equal(exploreHref(clearedExploreQuery(parsed), 1), '/explore?page=1&limit=18');
});

test('active filter helpers drive chips and clear-all without inventing controls', () => {
  assert.equal(exploreHasActiveFilters(parseExploreQuery({})), false);
  assert.equal(exploreHasActiveFilters(parseExploreQuery({ page: '2' })), false);
  assert.equal(exploreHasActiveFilters(parseExploreQuery({ q: 'lotus' })), true);

  const categories = [{ id: 'cat-1', name: 'Contemporary' }];
  const chips = exploreFilterChips(
    parseExploreQuery({
      q: 'lotus',
      categoryId: 'cat-1',
      minPricePaise: '',
      maxPricePaise: '10000000',
    }),
    { categories },
  );
  assert.deepEqual(chips.map((chip) => chip.id), ['q', 'categoryId', 'price']);
  assert.equal(chips[1].label, 'Contemporary');
  assert.equal(chips[2].label, PRICE_BANDS[0].label);
  assert.equal(priceBandLabel('30000000', ''), '₹3,00,000+');
  assert.equal(exploreFilterChips(parseExploreQuery({ page: '3' })).length, 0);
});

test('catalogue filter UI keeps live controls and hides unsupported medium, scale and movement', () => {
  const filters = read('components/explore-filters.js');
  const layout = read('app/(gallery)/explore/layout.js');
  const page = read('app/(gallery)/explore/page.js');

  assert.match(filters, /Apply filters/);
  assert.match(filters, /Clear all/);
  assert.match(filters, /exploreFilterChips/);
  assert.match(filters, /name="q"/);
  assert.match(filters, /name="categoryId"/);
  assert.match(filters, /Acquisition value/);
  assert.match(filters, /lg:grid-cols-12/);
  assert.doesNotMatch(filters, /Medium|Scale|Movement/);
  assert.doesNotMatch(filters, /does not filter/);
  assert.doesNotMatch(layout, /Medium, scale and movement/);
  assert.match(layout, /search, category or acquisition value/);
  assert.match(page, /Clear all filters/);
  assert.match(page, /exploreHasActiveFilters/);
  assert.match(page, /listArtworks/);
  assert.doesNotMatch(page, /medium|orientation|movement|artistId/);
});
