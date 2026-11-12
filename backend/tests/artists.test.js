import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { eq, ilike, inArray, or } from 'drizzle-orm';
import { client, db } from '../src/config/database.js';
import { artists, artworks, auditLogs } from '../src/db/schema/index.js';
import {
  assertPortraitStoragePathForArtist,
  artistPortraitStoragePath,
} from '../src/lib/artist-portrait.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { uniqueSlug } from '../src/utils/slug.js';
import { artistCreateBody, artistUpdateBody } from '../src/validators/artist.validators.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

async function artistsReady() {
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    return false;
  }
  const response = await api('/api/v1/artists');
  return response.status === 200;
}

async function insertArtwork(status, title, extras = {}) {
  const [row] = await db.insert(artworks).values({
    title,
    slug: uniqueSlug(title),
    artistName: extras.artistName || 'Unresolved Atelier',
    artistId: extras.artistId ?? null,
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

test('portrait path helper stores under artists/{artistId}/portrait.{ext}', () => {
  const artistId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.equal(artistPortraitStoragePath(artistId, 'head.PNG'), `artists/${artistId}/portrait.png`);
  assert.equal(artistPortraitStoragePath(artistId, 'face.JPEG'), `artists/${artistId}/portrait.jpg`);
  assert.equal(artistPortraitStoragePath(artistId, 'face.webp'), `artists/${artistId}/portrait.webp`);
  assert.equal(artistPortraitStoragePath(artistId, 'face.avif'), `artists/${artistId}/portrait.avif`);
  assert.doesNotThrow(() => assertPortraitStoragePathForArtist(artistId, `artists/${artistId}/portrait.jpg`));
  assert.throws(
    () => assertPortraitStoragePathForArtist(artistId, `${artistId}/portrait.jpg`),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertPortraitStoragePathForArtist(artistId, `artists/${artistId}/../secret.jpg`),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertPortraitStoragePathForArtist(artistId, `artists/${artistId}/gallery.jpg`),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertPortraitStoragePathForArtist(artistId, `blogs/${artistId}/cover.jpg`),
    (error) => error.statusCode === 400,
  );
});

test('artist validators require a name and reject unknown statuses', () => {
  assert.equal(artistCreateBody.safeParse({ name: 'Atelier North' }).success, true);
  assert.equal(artistCreateBody.safeParse({ name: '' }).success, false);
  assert.equal(artistCreateBody.safeParse({ name: 'Atelier North', status: 'archived' }).success, false);
  assert.equal(artistUpdateBody.safeParse({}).success, true);
  assert.equal(artistUpdateBody.safeParse({ slug: 'Not A Slug' }).success, false);
});

test('checkout snapshots still store artistName and are not rewritten by artist APIs', () => {
  const checkout = fs.readFileSync(path.join(backendRoot, 'src/services/checkout.service.js'), 'utf8');
  assert.match(checkout, /function snapshotArtwork/);
  assert.match(checkout, /artistName: artwork\.artistName/);
  assert.doesNotMatch(checkout, /artistId: artwork\.artistId/);
  const artistService = fs.readFileSync(path.join(backendRoot, 'src/services/artist.service.js'), 'utf8');
  assert.doesNotMatch(artistService, /orderItems|artworkSnapshot/);
});

test('customers cannot create artists', async () => {
  mockIdentity();
  const response = await api('/api/v1/admin/artists', {
    method: 'POST',
    headers: { Authorization: 'Bearer customer-token' },
    body: { name: 'Forbidden artist' },
  });
  assert.equal(response.status, 403);
});

test('unauthenticated callers cannot list admin artists', async () => {
  const response = await api('/api/v1/admin/artists');
  assert.equal(response.status, 401);
});

test('artist CRUD, visibility, association, rename, delete and audit logs', async (t) => {
  if (!await artistsReady()) {
    t.skip('database or artists migration is not reachable from this environment');
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
  const suffix = uniqueSlug('artist');
  const createdIds = [];
  const artworkIds = [];

  try {
    const draft = await api('/api/v1/admin/artists', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        name: `Draft ${suffix}`,
        slug: `draft-${suffix}`,
        shortBio: 'Not yet public.',
      },
    });
    assert.equal(draft.status, 201, JSON.stringify(draft.json));
    assert.equal(draft.json.data.status, 'draft');
    assert.equal(draft.json.data.publishedAt, null);
    createdIds.push(draft.json.data.id);

    const publicDraft = await api(`/api/v1/artists/${draft.json.data.slug}`);
    assert.equal(publicDraft.status, 404);

    const publicListBefore = await api('/api/v1/artists');
    assert.equal(publicListBefore.status, 200);
    assert.equal(
      (publicListBefore.json.data.items || []).some((item) => item.id === draft.json.data.id),
      false,
    );

    const published = await api(`/api/v1/admin/artists/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'published' },
    });
    assert.equal(published.status, 200);
    assert.equal(published.json.data.status, 'published');
    assert.ok(published.json.data.publishedAt);
    const firstPublishedAt = published.json.data.publishedAt;

    const publicDetail = await api(`/api/v1/artists/${draft.json.data.slug}`);
    assert.equal(publicDetail.status, 200);
    assert.equal(publicDetail.json.data.name, `Draft ${suffix}`);

    const duplicate = await api('/api/v1/admin/artists', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        name: `Copy ${suffix}`,
        slug: `draft-${suffix}`,
      },
    });
    assert.equal(duplicate.status, 409);

    const unpublished = await api(`/api/v1/admin/artists/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'draft' },
    });
    assert.equal(unpublished.status, 200);
    assert.equal(unpublished.json.data.status, 'draft');
    assert.equal(unpublished.json.data.publishedAt, firstPublishedAt);

    const hiddenAgain = await api(`/api/v1/artists/${draft.json.data.slug}`);
    assert.equal(hiddenAgain.status, 404);

    const republished = await api(`/api/v1/admin/artists/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'published' },
    });
    assert.equal(republished.json.data.publishedAt, firstPublishedAt);

    const publishedWork = await insertArtwork('published', `Published ${suffix}`, {
      artistId: draft.json.data.id,
      artistName: `Draft ${suffix}`,
    });
    const draftWork = await insertArtwork('draft', `Draft work ${suffix}`, {
      artistId: draft.json.data.id,
      artistName: `Draft ${suffix}`,
    });
    const unresolved = await insertArtwork('published', `Unresolved ${suffix}`, {
      artistName: 'Legacy Attribution',
    });
    artworkIds.push(publishedWork.id, draftWork.id, unresolved.id);

    const profile = await api(`/api/v1/artists/${draft.json.data.slug}`);
    assert.equal(profile.status, 200);
    const profileIds = (profile.json.data.artworks || []).map((item) => item.id);
    assert.equal(profileIds.includes(publishedWork.id), true);
    assert.equal(profileIds.includes(draftWork.id), false);

    const publicArtwork = await api(`/api/v1/artworks/${publishedWork.id}`);
    assert.equal(publicArtwork.status, 200);
    assert.equal(publicArtwork.json.data.artistName, `Draft ${suffix}`);
    assert.equal(publicArtwork.json.data.artist?.slug, `draft-${suffix}`);

    const unresolvedPublic = await api(`/api/v1/artworks/${unresolved.id}`);
    assert.equal(unresolvedPublic.status, 200);
    assert.equal(unresolvedPublic.json.data.artistName, 'Legacy Attribution');
    assert.equal(unresolvedPublic.json.data.artist, null);

    const namedArtwork = await api('/api/v1/admin/artworks', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        title: `Name only ${suffix}`,
        artistName: 'Free Text Atelier',
        pricePaise: 120000,
      },
    });
    assert.equal(namedArtwork.status, 201, JSON.stringify(namedArtwork.json));
    artworkIds.push(namedArtwork.json.data.id);
    assert.equal(namedArtwork.json.data.artistName, 'Free Text Atelier');
    assert.equal(namedArtwork.json.data.artistId, null);

    const draftArtist = await api('/api/v1/admin/artists', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: { name: `Hidden ${suffix}`, slug: `hidden-${suffix}`, status: 'draft' },
    });
    assert.equal(draftArtist.status, 201);
    createdIds.push(draftArtist.json.data.id);

    const rejectDraft = await api('/api/v1/admin/artworks', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        title: `Linked draft ${suffix}`,
        artistId: draftArtist.json.data.id,
        pricePaise: 120000,
      },
    });
    assert.equal(rejectDraft.status, 400);

    const linked = await api('/api/v1/admin/artworks', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        title: `Linked published ${suffix}`,
        artistId: draft.json.data.id,
        pricePaise: 180000,
        status: 'draft',
      },
    });
    assert.equal(linked.status, 201, JSON.stringify(linked.json));
    artworkIds.push(linked.json.data.id);
    assert.equal(linked.json.data.artistId, draft.json.data.id);
    assert.equal(linked.json.data.artistName, `Draft ${suffix}`);

    const renamed = await api(`/api/v1/admin/artists/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { name: `Renamed ${suffix}` },
    });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.json.data.name, `Renamed ${suffix}`);

    const [synced] = await db.select().from(artworks).where(eq(artworks.id, publishedWork.id)).limit(1);
    assert.equal(synced.artistName, `Renamed ${suffix}`);
    assert.equal(synced.artistId, draft.json.data.id);

    const [legacy] = await db.select().from(artworks).where(eq(artworks.id, unresolved.id)).limit(1);
    assert.equal(legacy.artistName, 'Legacy Attribution');
    assert.equal(legacy.artistId, null);

    const keepDraftLink = await api(`/api/v1/admin/artworks/${publishedWork.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: draft.json.data.id, title: `Published keep ${suffix}` },
    });
    assert.equal(keepDraftLink.status, 200);

    await api(`/api/v1/admin/artists/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'draft' },
    });

    const keepAfterUnpublish = await api(`/api/v1/admin/artworks/${publishedWork.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: draft.json.data.id },
    });
    assert.equal(keepAfterUnpublish.status, 200, JSON.stringify(keepAfterUnpublish.json));

    const switchToDraft = await api(`/api/v1/admin/artworks/${unresolved.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: draftArtist.json.data.id },
    });
    assert.equal(switchToDraft.status, 400);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, draft.json.data.id));
    const actions = logs.map((row) => row.action);
    assert.equal(actions.includes('artist.create'), true);
    assert.equal(actions.includes('artist.publish'), true);
    assert.equal(actions.includes('artist.unpublish'), true);
    assert.equal(actions.includes('artist.update'), true);

    const originalName = `Renamed ${suffix}`;
    const removed = await api(`/api/v1/admin/artists/${draft.json.data.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(removed.status, 200);
    assert.equal(removed.json.data.deleted, true);

    const [afterDelete] = await db.select().from(artworks).where(eq(artworks.id, publishedWork.id)).limit(1);
    assert.equal(afterDelete.artistId, null);
    assert.equal(afterDelete.artistName, originalName);

    const gone = await api(`/api/v1/admin/artists/${draft.json.data.id}`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(gone.status, 404);
    const remaining = createdIds.indexOf(draft.json.data.id);
    if (remaining >= 0) {
      createdIds.splice(remaining, 1);
    }

    const deleteLogs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, draft.json.data.id));
    assert.equal(deleteLogs.some((row) => row.action === 'artist.delete'), true);
  } finally {
    if (artworkIds.length > 0) {
      await db.delete(artworks).where(inArray(artworks.id, artworkIds));
    }
    await db.delete(artists).where(or(
      ilike(artists.slug, `%${suffix}%`),
      ilike(artists.slug, 'debug-artist-%'),
    ));
    if (createdIds.length > 0) {
      await db.delete(artists).where(inArray(artists.id, createdIds));
    }
  }
});
