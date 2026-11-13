import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inArray } from 'drizzle-orm';
import { client, db } from '../src/config/database.js';
import { artists, artworks } from '../src/db/schema/index.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { uniqueSlug } from '../src/utils/slug.js';
import { api, stopTestServer } from './helpers/http.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';

const FEATURED_FIELDS = [
  'id',
  'title',
  'story',
  'medium',
  'yearCreated',
  'width',
  'height',
  'depth',
  'dimensionUnit',
  'pricePaise',
  'status',
  'availableQuantity',
  'isPurchasable',
  'images',
];

const TILE_FIELDS = [
  'id',
  'title',
  'medium',
  'width',
  'height',
  'depth',
  'dimensionUnit',
  'pricePaise',
  'status',
  'availableQuantity',
  'isPurchasable',
  'images',
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
    artistName: extras.artistName || 'Preview Artist',
    artistId: extras.artistId ?? null,
    story: extras.story ?? null,
    medium: extras.medium ?? 'Oil on canvas',
    yearCreated: extras.yearCreated ?? 2024,
    width: extras.width ?? '40',
    height: extras.height ?? '50',
    pricePaise: extras.pricePaise ?? 250000,
    inventoryQuantity: extras.inventoryQuantity ?? 1,
    status,
  }).returning();
  return row;
}

function assertHasFields(item, fields) {
  for (const field of fields) {
    assert.equal(Object.hasOwn(item, field), true, `missing preview field ${field}`);
  }
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('public artist artwork hydration uses a preview DTO instead of full catalogue list hydration', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/artist.service.js'), 'utf8');
  assert.match(source, /hydratePublicArtworkPreviews/);
  assert.match(source, /toArtistArtworkPreview/);
  assert.match(source, /ARTIST_PUBLIC_ARTWORK_LIMIT = 100/);
  assert.match(source, /artworks: await hydratePublicArtworkPreviews\(row\.id\)/);
  assert.match(source, /artworks: await hydrateArtworks\(row\.id, \{ publicOnly: false \}\)/);
  assert.match(source, /listArtworks\(/);
  assert.match(source, /if \(featured\) \{[\s\S]*preview\.story = artwork\.story/);
});

test('artist public previews preserve published-only newest-first order, featured story, and notFound', async (t) => {
  if (!await artistsReady()) {
    t.skip('database or artists schema is not reachable from this environment');
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
  const suffix = uniqueSlug('artist-preview');
  const artworkIds = [];
  let artistId = null;
  let slug = `preview-${suffix}`;

  try {
    const created = await api('/api/v1/admin/artists', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        name: `Preview ${suffix}`,
        slug,
        shortBio: 'Preview artist.',
        biography: 'Keep the monograph copy.',
        status: 'published',
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    artistId = created.json.data.id;
    assert.deepEqual(created.json.data.artworks, []);

    const zero = await api(`/api/v1/artists/${slug}`);
    assert.equal(zero.status, 200);
    assert.deepEqual(zero.json.data.artworks, []);
    assert.equal(zero.json.data.name, `Preview ${suffix}`);
    assert.equal(zero.json.data.biography, 'Keep the monograph copy.');

    const only = await insertArtwork('published', `Only ${suffix}`, {
      artistId,
      artistName: `Preview ${suffix}`,
      story: 'Featured story copy.',
      yearCreated: 2021,
    });
    artworkIds.push(only.id);

    const one = await api(`/api/v1/artists/${slug}`);
    assert.equal(one.status, 200);
    assert.equal(one.json.data.artworks.length, 1);
    assert.equal(one.json.data.artworks[0].id, only.id);
    assert.equal(one.json.data.artworks[0].story, 'Featured story copy.');
    assert.equal(one.json.data.artworks[0].yearCreated, 2021);
    assertHasFields(one.json.data.artworks[0], FEATURED_FIELDS);

    const older = await insertArtwork('published', `Older ${suffix}`, {
      artistId,
      artistName: `Preview ${suffix}`,
      story: 'Older story should not appear on a tile.',
      yearCreated: 2019,
    });
    const newest = await insertArtwork('published', `Newest ${suffix}`, {
      artistId,
      artistName: `Preview ${suffix}`,
      story: 'Newest featured story.',
      yearCreated: 2026,
    });
    const draftWork = await insertArtwork('draft', `Draft ${suffix}`, {
      artistId,
      artistName: `Preview ${suffix}`,
      story: 'Draft story.',
    });
    artworkIds.push(older.id, newest.id, draftWork.id);

    const many = await api(`/api/v1/artists/${slug}`);
    assert.equal(many.status, 200);
    const works = many.json.data.artworks || [];
    assert.deepEqual(works.map((item) => item.id), [newest.id, older.id, only.id]);
    assert.equal(works.some((item) => item.id === draftWork.id), false);
    assert.equal(works[0].story, 'Newest featured story.');
    assert.equal(works[0].yearCreated, 2026);
    assertHasFields(works[0], FEATURED_FIELDS);
    assert.equal(Object.hasOwn(works[1], 'story'), false);
    assert.equal(Object.hasOwn(works[2], 'story'), false);
    assertHasFields(works[1], TILE_FIELDS);
    assertHasFields(works[2], TILE_FIELDS);
    assert.equal(works[0].isPurchasable, true);
    assert.equal(Array.isArray(works[0].images), true);

    const admin = await api(`/api/v1/admin/artists/${artistId}`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(admin.status, 200);
    const adminIds = (admin.json.data.artworks || []).map((item) => item.id);
    assert.equal(adminIds.includes(draftWork.id), true);
    assert.equal(adminIds.includes(newest.id), true);

    const unpublished = await api(`/api/v1/admin/artists/${artistId}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'draft' },
    });
    assert.equal(unpublished.status, 200);
    const hidden = await api(`/api/v1/artists/${slug}`);
    assert.equal(hidden.status, 404);
  } finally {
    if (artistId) {
      await db.delete(artists).where(inArray(artists.id, [artistId]));
    }
    if (artworkIds.length > 0) {
      await db.delete(artworks).where(inArray(artworks.id, artworkIds));
    }
  }
});
