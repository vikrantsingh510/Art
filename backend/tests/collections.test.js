import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { eq, ilike, inArray, or } from 'drizzle-orm';
import { client, db } from '../src/config/database.js';
import { artworks, auditLogs, collections } from '../src/db/schema/index.js';
import {
  assertCoverStoragePathForCollection,
  collectionCoverStoragePath,
} from '../src/lib/collection-cover.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { uniqueSlug } from '../src/utils/slug.js';
import { artworkUpdateBody } from '../src/validators/artwork.validators.js';
import {
  collectionArtworksBody,
  collectionBody,
  collectionUpdateBody,
} from '../src/validators/catalog.validators.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const missingArtworkId = '99999999-9999-4999-8999-999999999999';
const missingCollectionId = '88888888-8888-4888-8888-888888888888';

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

async function collectionsReady() {
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    return false;
  }
  const response = await api('/api/v1/collections');
  return response.status === 200;
}

async function insertArtwork(status, title) {
  const [row] = await db.insert(artworks).values({
    title,
    slug: uniqueSlug(title),
    artistName: 'Artist',
    pricePaise: 250000,
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

test('cover path helper stores under collections/{collectionId}/cover.{ext}', () => {
  const collectionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.equal(collectionCoverStoragePath(collectionId, 'hero.PNG'), `collections/${collectionId}/cover.png`);
  assert.equal(collectionCoverStoragePath(collectionId, 'hero.JPEG'), `collections/${collectionId}/cover.jpg`);
  assert.doesNotThrow(() => assertCoverStoragePathForCollection(collectionId, `collections/${collectionId}/cover.jpg`));
  assert.throws(
    () => assertCoverStoragePathForCollection(collectionId, `${collectionId}/cover.jpg`),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertCoverStoragePathForCollection(collectionId, `collections/${collectionId}/../secret.jpg`),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertCoverStoragePathForCollection(collectionId, 'artworks/cover.jpg'),
    (error) => error.statusCode === 400,
  );
});

test('collection validators require a name and reject duplicate membership ids', () => {
  assert.equal(collectionBody.safeParse({ name: 'Monsoon studies' }).success, true);
  assert.equal(collectionBody.safeParse({ name: '' }).success, false);
  assert.equal(collectionBody.safeParse({ name: 'Monsoon studies', slug: 'Not A Slug' }).success, false);
  assert.equal(collectionUpdateBody.safeParse({}).success, true);
  assert.equal(collectionUpdateBody.parse({ coverImagePath: null }).isPublished, undefined);
  assert.equal(collectionArtworksBody.safeParse({ artworkIds: [] }).success, true);
  assert.equal(collectionArtworksBody.safeParse({ artworkIds: ['not-a-uuid'] }).success, false);
});

test('artwork PATCH omits collection membership unless collectionIds is sent', () => {
  const parsed = artworkUpdateBody.parse({ title: 'Lotus' });
  assert.equal(parsed.collectionIds, undefined);
  const withIds = artworkUpdateBody.parse({
    collectionIds: ['11111111-1111-4111-8111-111111111111'],
  });
  assert.deepEqual(withIds.collectionIds, ['11111111-1111-4111-8111-111111111111']);
});

test('customers cannot create collections', async () => {
  mockIdentity();
  const response = await api('/api/v1/admin/collections', {
    method: 'POST',
    headers: { Authorization: 'Bearer customer-token' },
    body: { name: 'Forbidden hanging' },
  });
  assert.equal(response.status, 403);
});

test('unauthenticated callers cannot list admin collections', async () => {
  const response = await api('/api/v1/admin/collections');
  assert.equal(response.status, 401);
});

test('customers cannot list admin collections', async () => {
  mockIdentity();
  const response = await api('/api/v1/admin/collections', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(response.status, 403);
});

test('unauthenticated callers cannot read an admin collection by id', async () => {
  const response = await api(`/api/v1/admin/collections/${missingCollectionId}`);
  assert.equal(response.status, 401);
});

test('collection drafts, publishing, slugs, membership, order, privacy and artwork-form compatibility', async (t) => {
  if (!await collectionsReady()) {
    t.skip('database or collections schema is not reachable from this environment');
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
  const suffix = uniqueSlug('hanging');
  const createdIds = [];
  const artworkIds = [];

  try {
    const draft = await api('/api/v1/admin/collections', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        name: `Draft ${suffix}`,
        slug: `draft-${suffix}`,
        description: 'A private hanging.',
      },
    });
    assert.equal(draft.status, 201, JSON.stringify(draft.json));
    assert.equal(draft.json.data.isPublished, false);
    assert.equal(draft.json.data.coverImagePath, null);
    assert.deepEqual(draft.json.data.artworkIds, []);
    createdIds.push(draft.json.data.id);

    const publicDraft = await api(`/api/v1/collections/${draft.json.data.id}`);
    assert.equal(publicDraft.status, 404);

    const publicListBefore = await api('/api/v1/collections');
    assert.equal(publicListBefore.status, 200);
    assert.equal(
      (publicListBefore.json.data || []).some((item) => item.id === draft.json.data.id),
      false,
    );

    const published = await api(`/api/v1/admin/collections/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { isPublished: true },
    });
    assert.equal(published.status, 200);
    assert.equal(published.json.data.isPublished, true);

    const publicDetailEmpty = await api(`/api/v1/collections/${draft.json.data.id}`);
    assert.equal(publicDetailEmpty.status, 200);
    assert.equal(publicDetailEmpty.json.data.name, `Draft ${suffix}`);
    assert.deepEqual(publicDetailEmpty.json.data.artworkIds, []);

    const duplicate = await api('/api/v1/admin/collections', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        name: `Copy ${suffix}`,
        slug: `draft-${suffix}`,
      },
    });
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.json.message || duplicate.json.error?.message || '', /slug/i);

    const unpublished = await api(`/api/v1/admin/collections/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { isPublished: false },
    });
    assert.equal(unpublished.status, 200);
    assert.equal(unpublished.json.data.isPublished, false);
    const hiddenAgain = await api(`/api/v1/collections/${draft.json.data.id}`);
    assert.equal(hiddenAgain.status, 404);

    const republished = await api(`/api/v1/admin/collections/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { isPublished: true },
    });
    assert.equal(republished.status, 200);

    const first = await insertArtwork('published', `First ${suffix}`);
    const second = await insertArtwork('published', `Second ${suffix}`);
    const third = await insertArtwork('published', `Third ${suffix}`);
    const draftWork = await insertArtwork('draft', `Draft work ${suffix}`);
    const reservedWork = await insertArtwork('reserved', `Reserved ${suffix}`);
    const soldWork = await insertArtwork('sold', `Sold ${suffix}`);
    artworkIds.push(first.id, second.id, third.id, draftWork.id, reservedWork.id, soldWork.id);

    const invalidMembership = await api(`/api/v1/admin/collections/${draft.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [first.id, missingArtworkId] },
    });
    assert.equal(invalidMembership.status, 400);

    const duplicateMembership = await api(`/api/v1/admin/collections/${draft.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [first.id, first.id] },
    });
    assert.equal(duplicateMembership.status, 400);

    const missingCollection = await api(`/api/v1/admin/collections/${missingCollectionId}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [first.id] },
    });
    assert.equal(missingCollection.status, 404);

    const associate = await api(`/api/v1/admin/collections/${draft.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [third.id, first.id, second.id, draftWork.id, reservedWork.id, soldWork.id] },
    });
    assert.equal(associate.status, 200, JSON.stringify(associate.json));
    assert.deepEqual(
      associate.json.data.artworkIds,
      [third.id, first.id, second.id, draftWork.id, reservedWork.id, soldWork.id],
    );
    assert.deepEqual(
      associate.json.data.artworks.map((item) => item.displayOrder),
      [0, 1, 2, 3, 4, 5],
    );

    const failedReplace = await api(`/api/v1/admin/collections/${draft.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [first.id, missingArtworkId] },
    });
    assert.equal(failedReplace.status, 400);
    const afterFailedReplace = await api(`/api/v1/admin/collections/${draft.json.data.id}`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(afterFailedReplace.status, 200);
    assert.deepEqual(
      afterFailedReplace.json.data.artworkIds,
      [third.id, first.id, second.id, draftWork.id, reservedWork.id, soldWork.id],
    );

    const publicMembers = await api(`/api/v1/collections/${draft.json.data.id}`);
    assert.equal(publicMembers.status, 200);
    assert.deepEqual(publicMembers.json.data.artworkIds, [third.id, first.id, second.id]);
    assert.equal(publicMembers.json.data.artworkIds.includes(draftWork.id), false);
    assert.equal(publicMembers.json.data.artworkIds.includes(reservedWork.id), false);
    assert.equal(publicMembers.json.data.artworkIds.includes(soldWork.id), false);

    const listed = await api(`/api/v1/artworks?collectionId=${draft.json.data.id}&limit=100`);
    assert.equal(listed.status, 200);
    assert.deepEqual(
      (listed.json.data.items || []).map((item) => item.id),
      [third.id, first.id, second.id],
    );

    const artworkPatch = await api(`/api/v1/admin/artworks/${draftWork.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { title: `Draft renamed ${suffix}` },
    });
    assert.equal(artworkPatch.status, 200, JSON.stringify(artworkPatch.json));
    const afterArtworkPatch = await api(`/api/v1/admin/collections/${draft.json.data.id}`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.deepEqual(
      afterArtworkPatch.json.data.artworkIds,
      [third.id, first.id, second.id, draftWork.id, reservedWork.id, soldWork.id],
    );
    assert.equal(
      afterArtworkPatch.json.data.artworks.find((item) => item.id === draftWork.id).displayOrder,
      3,
    );

    const removed = await api(`/api/v1/admin/collections/${draft.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [second.id, third.id] },
    });
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.json.data.artworkIds, [second.id, third.id]);
    assert.deepEqual(removed.json.data.artworks.map((item) => item.displayOrder), [0, 1]);

    const emptied = await api(`/api/v1/admin/collections/${draft.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [] },
    });
    assert.equal(emptied.status, 200);
    assert.deepEqual(emptied.json.data.artworkIds, []);

    const invalidCover = await api(`/api/v1/admin/collections/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { coverImagePath: 'artworks/cover.jpg' },
    });
    assert.equal(invalidCover.status, 400);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, draft.json.data.id));
    const actions = logs.map((row) => row.action);
    assert.equal(actions.includes('collection.create'), true);
    assert.equal(actions.includes('collection.publish'), true);
    assert.equal(actions.includes('collection.unpublish'), true);
    assert.equal(actions.includes('collection.artworks.replace'), true);
  } finally {
    await db.delete(collections).where(or(
      ilike(collections.slug, `%${suffix}%`),
      inArray(collections.id, createdIds.length > 0 ? createdIds : [missingCollectionId]),
    ));
    if (artworkIds.length > 0) {
      await db.delete(artworks).where(inArray(artworks.id, artworkIds));
    }
  }
});
