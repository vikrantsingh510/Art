import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slugify, uniqueSlug } from '../src/utils/slug.js';

test('slugify normalizes titles', () => {
  assert.equal(slugify('Blue Temple  Wall'), 'blue-temple-wall');
  assert.equal(slugify(''), 'item');
});

test('uniqueSlug appends a suffix', () => {
  const slug = uniqueSlug('Blue Temple');
  assert.match(slug, /^blue-temple-[a-z0-9]+$/);
});
