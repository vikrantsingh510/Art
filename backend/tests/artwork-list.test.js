import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inArray } from 'drizzle-orm';
import { client, db } from '../src/config/database.js';
import {
  artworkCategories,
  artworks,
  categories,
  collections,
} from '../src/db/schema/index.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { uniqueSlug } from '../src/utils/slug.js';
import { api, stopTestServer } from './helpers/http.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const missingId = '99999999-9999-4999-8999-999999999999';

const PUBLIC_LIST_FIELDS = [
  'id',
  'title',
  'slug',
  'description',
  'story',
  'technique',
  'medium',
  'material',
  'artistName',
  'artistId',
  'yearCreated',
  'width',
  'height',
  'depth',
  'dimensionUnit',
  'pricePaise',
  'currency',
  'inventoryQuantity',
  'status',
  'isFeatured',
  'createdAt',
  'updatedAt',
  'reservedQuantity',
  'availableQuantity',
  'isPurchasable',
  'artist',
  'images',
  'media',
  'categoryIds',
  'collectionIds',
];

function mockIdentity(actorAdminId = adminId) {
  setAuthDependencies({
    verifyAccessToken: async (token) => {
      if (token === 'customer-token') {
        return { userId: customerId, email: 'customer@example.com', fullName: 'Customer' };
      }
      if (token === 'admin-token') {
        return { userId: actorAdminId, email: 'admin@example.com', fullName: 'Admin' };
      }
      throw new ApiError(401, 'Invalid or expired access token');
    },
    provisionIdentity: async () => {},
    loadProfileWithRoles: async (userId) => ({
      profile: { id: userId, fullName: userId === actorAdminId ? 'Admin' : 'Customer' },
      roles: userId === actorAdminId ? ['customer', 'admin'] : ['customer'],
    }),
  });
}

async function databaseReady() {
  const health = await api('/api/v1/health/db');
  return health.status === 200;
}

function assertListContract(item) {
  for (const field of PUBLIC_LIST_FIELDS) {
    assert.equal(Object.hasOwn(item, field), true, `missing list field ${field}`);
  }
  assert.equal(Array.isArray(item.images), true);
  assert.equal(Array.isArray(item.media), true);
  assert.equal(Array.isArray(item.categoryIds), true);
  assert.equal(Array.isArray(item.collectionIds), true);
  assert.equal(typeof item.reservedQuantity, 'number');
  assert.equal(typeof item.availableQuantity, 'number');
  assert.equal(typeof item.isPurchasable, 'boolean');
  assert.equal(item.availableQuantity, Math.max(0, item.inventoryQuantity - item.reservedQuantity));
}

async function insertArtwork(status, title) {
  const [row] = await db.insert(artworks).values({
    title,
    slug: uniqueSlug(title),
    artistName: 'List Artist',
    pricePaise: 250000,
    inventoryQuantity: 1,
    status,
  }).returning();
  return row;
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('artwork list count joins membership tables only when those filters are requested', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/artwork.service.js'), 'utf8');
  const listStart = source.indexOf('export async function listArtworks');
  const idsStart = source.indexOf('export async function getArtworksByIds');
  const listSource = source.slice(listStart, idsStart);

  assert.match(listSource, /count\(distinct \$\{artworks\.id\}\)/);
  assert.match(listSource, /if \(query\.categoryId\) \{[\s\S]*innerJoin\(\s*artworkCategories/);
  assert.match(listSource, /if \(query\.collectionId\) \{[\s\S]*innerJoin\(\s*collectionArtworks/);
  assert.doesNotMatch(listSource, /leftJoin\(\s*artworkCategories/);
  assert.doesNotMatch(listSource, /leftJoin\(\s*collectionArtworks/);
});

test('attachRelations loads reserved quantities alongside independent relation queries', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/artwork.service.js'), 'utf8');
  const attachStart = source.indexOf('async function attachRelations');
  const replaceStart = source.indexOf('async function replaceArtworkLinks');
  const attachSource = source.slice(attachStart, replaceStart);

  assert.match(attachSource, /Promise\.all\(\[/);
  assert.match(attachSource, /getActiveReservedQuantities\(artworkIds\)/);
  assert.match(attachSource, /from\(artworkImages\)/);
  assert.match(attachSource, /from\(artworkMedia\)/);
  assert.match(attachSource, /from\(artworkCategories\)/);
  assert.match(attachSource, /from\(collectionArtworks\)/);
  assert.doesNotMatch(
    attachSource,
    /const reservedMap = await getActiveReservedQuantities\(artworkIds\);\s*const \[/,
  );
});

test('artwork list totals, filters, pagination and contracts stay correct', async (t) => {
  if (!await databaseReady()) {
    t.skip('database is not reachable from this environment');
    return;
  }

  const [adminRow] = await client`
    SELECT user_id
    FROM public.user_roles
    WHERE role = 'admin'
    LIMIT 1
  `;
  if (!adminRow?.user_id) {
    t.skip('no admin profile exists in this database');
    return;
  }

  mockIdentity(adminRow.user_id);
  const suffix = uniqueSlug('list');
  const artworkIds = [];
  const categoryIds = [];
  const collectionIds = [];

  try {
    const before = await api('/api/v1/artworks?limit=1');
    assert.equal(before.status, 200);
    const unfilteredBefore = Number(before.json.data.total || 0);

    const emptyCategory = await api(`/api/v1/artworks?categoryId=${missingId}`);
    assert.equal(emptyCategory.status, 200);
    assert.equal(emptyCategory.json.data.total, 0);
    assert.deepEqual(emptyCategory.json.data.items, []);

    const emptyCollection = await api(`/api/v1/artworks?collectionId=${missingId}`);
    assert.equal(emptyCollection.status, 200);
    assert.equal(emptyCollection.json.data.total, 0);
    assert.deepEqual(emptyCollection.json.data.items, []);

    const catA = await api('/api/v1/admin/categories', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: { name: `Cat A ${suffix}`, slug: `cat-a-${suffix}` },
    });
    assert.equal(catA.status, 201, JSON.stringify(catA.json));
    categoryIds.push(catA.json.data.id);

    const catB = await api('/api/v1/admin/categories', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: { name: `Cat B ${suffix}`, slug: `cat-b-${suffix}` },
    });
    assert.equal(catB.status, 201, JSON.stringify(catB.json));
    categoryIds.push(catB.json.data.id);

    const colA = await api('/api/v1/admin/collections', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        name: `Col A ${suffix}`,
        slug: `col-a-${suffix}`,
        isPublished: true,
      },
    });
    assert.equal(colA.status, 201, JSON.stringify(colA.json));
    collectionIds.push(colA.json.data.id);

    const colB = await api('/api/v1/admin/collections', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        name: `Col B ${suffix}`,
        slug: `col-b-${suffix}`,
        isPublished: true,
      },
    });
    assert.equal(colB.status, 201, JSON.stringify(colB.json));
    collectionIds.push(colB.json.data.id);

    const first = await insertArtwork('published', `First ${suffix}`);
    const second = await insertArtwork('published', `Second ${suffix}`);
    const third = await insertArtwork('published', `Third ${suffix}`);
    const draft = await insertArtwork('draft', `Draft ${suffix}`);
    artworkIds.push(first.id, second.id, third.id, draft.id);

    await db.insert(artworkCategories).values([
      { artworkId: first.id, categoryId: catA.json.data.id },
      { artworkId: first.id, categoryId: catB.json.data.id },
      { artworkId: second.id, categoryId: catA.json.data.id },
      { artworkId: draft.id, categoryId: catA.json.data.id },
    ]);

    const associateA = await api(`/api/v1/admin/collections/${colA.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [second.id, first.id, draft.id] },
    });
    assert.equal(associateA.status, 200, JSON.stringify(associateA.json));

    const associateB = await api(`/api/v1/admin/collections/${colB.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [first.id] },
    });
    assert.equal(associateB.status, 200, JSON.stringify(associateB.json));

    const unfiltered = await api('/api/v1/artworks?limit=100');
    assert.equal(unfiltered.status, 200);
    assert.equal(unfiltered.json.data.total, unfilteredBefore + 3);
    const unfilteredIds = (unfiltered.json.data.items || []).map((item) => item.id);
    assert.equal(unfilteredIds.includes(first.id), true);
    assert.equal(unfilteredIds.includes(second.id), true);
    assert.equal(unfilteredIds.includes(third.id), true);
    assert.equal(unfilteredIds.includes(draft.id), false);
    unfiltered.json.data.items.forEach(assertListContract);

    const newestFirst = unfiltered.json.data.items.filter((item) => artworkIds.includes(item.id));
    assert.deepEqual(newestFirst.map((item) => item.id), [third.id, second.id, first.id]);

    const categoryA = await api(`/api/v1/artworks?categoryId=${catA.json.data.id}&limit=100`);
    assert.equal(categoryA.status, 200);
    assert.equal(categoryA.json.data.total, 2);
    assert.deepEqual(
      (categoryA.json.data.items || []).map((item) => item.id).sort(),
      [first.id, second.id].sort(),
    );

    const categoryB = await api(`/api/v1/artworks?categoryId=${catB.json.data.id}&limit=100`);
    assert.equal(categoryB.status, 200);
    assert.equal(categoryB.json.data.total, 1);
    assert.deepEqual((categoryB.json.data.items || []).map((item) => item.id), [first.id]);

    const collectionA = await api(`/api/v1/artworks?collectionId=${colA.json.data.id}&limit=100`);
    assert.equal(collectionA.status, 200);
    assert.equal(collectionA.json.data.total, 2);
    assert.deepEqual(
      (collectionA.json.data.items || []).map((item) => item.id),
      [second.id, first.id],
    );

    const combined = await api(
      `/api/v1/artworks?categoryId=${catA.json.data.id}&collectionId=${colB.json.data.id}&limit=100`,
    );
    assert.equal(combined.status, 200);
    assert.equal(combined.json.data.total, 1);
    assert.deepEqual((combined.json.data.items || []).map((item) => item.id), [first.id]);

    const paged = await api(`/api/v1/artworks?categoryId=${catA.json.data.id}&page=1&limit=1`);
    assert.equal(paged.status, 200);
    assert.equal(paged.json.data.total, 2);
    assert.equal(paged.json.data.page, 1);
    assert.equal(paged.json.data.limit, 1);
    assert.equal(paged.json.data.items.length, 1);

    const adminList = await api(`/api/v1/admin/artworks?q=${encodeURIComponent(suffix)}&limit=100`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(adminList.status, 200, JSON.stringify(adminList.json));
    const adminIds = (adminList.json.data.items || []).map((item) => item.id);
    assert.equal(adminIds.includes(draft.id), true);
    assert.equal(adminIds.includes(first.id), true);
    adminList.json.data.items.forEach(assertListContract);

    const publicDraft = (unfiltered.json.data.items || []).find((item) => item.id === draft.id);
    assert.equal(publicDraft, undefined);

    const firstPublic = (unfiltered.json.data.items || []).find((item) => item.id === first.id);
    assert.equal(firstPublic.isPurchasable, true);
    assert.equal(firstPublic.availableQuantity, 1);
    assert.equal(firstPublic.reservedQuantity, 0);
    assert.equal(firstPublic.status, 'published');
  } finally {
    if (artworkIds.length > 0) {
      await db.delete(artworks).where(inArray(artworks.id, artworkIds));
    }
    if (collectionIds.length > 0) {
      await db.delete(collections).where(inArray(collections.id, collectionIds));
    }
    if (categoryIds.length > 0) {
      await db.delete(categories).where(inArray(categories.id, categoryIds));
    }
  }
});
