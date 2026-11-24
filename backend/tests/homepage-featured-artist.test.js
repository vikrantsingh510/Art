import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { desc, eq } from 'drizzle-orm';
import { client, db } from '../src/config/database.js';
import { APP_SETTING_HOMEPAGE_FEATURED_ARTIST, auditLogs } from '../src/db/schema/index.js';
import {
  readHomepageFeaturedArtistId,
  toHomepageFeaturedArtistSnapshot,
  toPublicHomepageFeaturedArtist,
} from '../src/lib/homepage-featured-artist.js';
import { toPublicArtistProfile } from '../src/services/artist.service.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { uniqueSlug } from '../src/utils/slug.js';
import { homepageFeaturedArtistSettingsBody } from '../src/validators/settings.validators.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const missingArtistId = '99999999-9999-4999-8999-999999999999';
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

const PUBLIC_FEATURED_ARTIST_KEYS = [
  'id',
  'name',
  'slug',
  'shortBio',
  'biography',
  'location',
  'profileImagePath',
  'profileImageAlt',
];

function assertPublicFeaturedEnvelope(data) {
  assert.deepEqual(Object.keys(data).sort(), ['artist']);
  assert.equal('updatedBy' in data, false);
  assert.equal('updated_by' in data, false);
  assert.equal('updatedAt' in data, false);
  assert.equal('value' in data, false);
  assert.equal('key' in data, false);
  assert.equal('status' in data, false);
  assert.equal('artistId' in data, false);
}

function assertPublicFeaturedArtistDto(artist) {
  assert.equal(Boolean(artist && typeof artist === 'object'), true);
  for (const key of PUBLIC_FEATURED_ARTIST_KEYS) {
    assert.equal(key in artist, true, `missing public field ${key}`);
  }
  assert.equal('status' in artist, false);
  assert.equal('artworks' in artist, false);
  assert.equal('createdAt' in artist, false);
  assert.equal('updatedAt' in artist, false);
  assert.equal('updatedBy' in artist, false);
}

async function featuredReady() {
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    return false;
  }
  const response = await api('/api/v1/homepage/featured-artist');
  return response.status === 200;
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('homepage featured artist reuses app_settings without a new migration or table', () => {
  const migrationsDir = path.join(backendRoot, 'src/db/migrations');
  assert.equal(fs.existsSync(path.join(migrationsDir, '0011_app_settings.sql')), true);
  assert.equal(fs.existsSync(path.join(migrationsDir, '0014_homepage_featured_artist.sql')), false);

  const schema = fs.readFileSync(path.join(backendRoot, 'src/db/schema/app-settings.schema.js'), 'utf8');
  assert.match(schema, /APP_SETTING_HOMEPAGE_FEATURED_ARTIST = 'homepage_featured_artist'/);
  assert.equal(APP_SETTING_HOMEPAGE_FEATURED_ARTIST, 'homepage_featured_artist');

  const service = fs.readFileSync(path.join(backendRoot, 'src/services/settings.service.js'), 'utf8');
  assert.doesNotMatch(service, /SUPABASE_SERVICE_ROLE_KEY|service_role|serviceRole/);
  const artistService = fs.readFileSync(path.join(backendRoot, 'src/services/artist.service.js'), 'utf8');
  assert.doesNotMatch(artistService, /homepage_featured_artist|APP_SETTING_HOMEPAGE_FEATURED_ARTIST/);
});

test('featured artist snapshot exposes the public artist DTO or null', () => {
  assert.deepEqual(toPublicHomepageFeaturedArtist(null), { artist: null });
  const profile = toPublicArtistProfile({
    id: missingArtistId,
    name: 'Pinned Painter',
    slug: 'pinned-painter',
    shortBio: 'Quiet afternoons.',
    biography: 'There was once a meadow.',
    location: 'Goa',
    profileImagePath: 'artists/x/portrait.jpg',
    profileImageAlt: 'Portrait of Pinned Painter',
    artisticStyle: 'Oil',
    medium: 'Canvas',
    seoTitle: 'Pinned',
    seoDescription: 'Featured',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    status: 'published',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedBy: 'secret',
  });
  assertPublicFeaturedArtistDto(profile);
  assert.equal(profile.biography, 'There was once a meadow.');
  assert.equal(profile.status, undefined);
  assert.deepEqual(toPublicHomepageFeaturedArtist(profile), { artist: profile });
  assert.equal(readHomepageFeaturedArtistId({ artistId: missingArtistId }), missingArtistId);
  assert.equal(readHomepageFeaturedArtistId({ artistId: 'not-a-uuid' }), null);
  assert.equal(readHomepageFeaturedArtistId({ artistId: 'https://evil.example' }), null);
  assertPublicFeaturedEnvelope(toPublicHomepageFeaturedArtist(profile));
  assert.deepEqual(
    toHomepageFeaturedArtistSnapshot({
      value: { artistId: missingArtistId, updatedBy: 'secret' },
      updatedBy: 'should-not-leak',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    {
      artistId: missingArtistId,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  );
});

test('featured artist validator accepts a UUID or null and rejects invalid ids', () => {
  assert.equal(homepageFeaturedArtistSettingsBody.safeParse({ artistId: missingArtistId }).success, true);
  assert.equal(homepageFeaturedArtistSettingsBody.safeParse({ artistId: null }).success, true);
  assert.equal(homepageFeaturedArtistSettingsBody.safeParse({}).success, false);
  assert.equal(homepageFeaturedArtistSettingsBody.safeParse({ artistId: 'not-a-uuid' }).success, false);
  assert.equal(homepageFeaturedArtistSettingsBody.safeParse({ artistId: '123' }).success, false);
});

test('public homepage featured artist is unauthenticated', async () => {
  const response = await api('/api/v1/homepage/featured-artist');
  assert.notEqual(response.status, 401);
  assert.notEqual(response.status, 403);
  if (response.status !== 200) {
    return;
  }
  assert.equal(response.json.success, true);
  assertPublicFeaturedEnvelope(response.json.data);
  if (response.json.data.artist) {
    assertPublicFeaturedArtistDto(response.json.data.artist);
  }
});

test('customers cannot read or write admin homepage featured artist settings', async () => {
  mockIdentity();
  const readResponse = await api('/api/v1/admin/settings/homepage-featured-artist', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(readResponse.status, 403);

  const writeResponse = await api('/api/v1/admin/settings/homepage-featured-artist', {
    method: 'PUT',
    headers: { Authorization: 'Bearer customer-token' },
    body: { artistId: missingArtistId },
  });
  assert.equal(writeResponse.status, 403);
});

test('unauthenticated callers cannot read or write admin homepage featured artist settings', async () => {
  const readResponse = await api('/api/v1/admin/settings/homepage-featured-artist');
  assert.equal(readResponse.status, 401);

  const writeResponse = await api('/api/v1/admin/settings/homepage-featured-artist', {
    method: 'PUT',
    body: { artistId: missingArtistId },
  });
  assert.equal(writeResponse.status, 401);
});

test('admin homepage featured artist validates, upserts, hides unpublished ids and audits', async (t) => {
  if (!await featuredReady()) {
    t.skip('database or app_settings is not reachable from this environment');
    return;
  }

  const [foundAdmin] = await client`
    SELECT user_id
    FROM public.user_roles
    WHERE role = 'admin'
    LIMIT 1
  `;
  if (!foundAdmin?.user_id) {
    t.skip('no admin profile exists in this database');
    return;
  }

  mockIdentity(foundAdmin.user_id);
  const previous = await api('/api/v1/admin/settings/homepage-featured-artist', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(previous.status, 200);
  assert.equal('artistId' in previous.json.data, true);
  assert.equal('updatedBy' in previous.json.data, false);

  const suffix = uniqueSlug('featured');
  const createdIds = [];

  try {
    const cleared = await api('/api/v1/admin/settings/homepage-featured-artist', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: null },
    });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.json.data.artistId, null);

    const publicNull = await api('/api/v1/homepage/featured-artist');
    assert.equal(publicNull.status, 200);
    assert.equal(publicNull.json.data.artist, null);
    assertPublicFeaturedEnvelope(publicNull.json.data);
    assert.equal(JSON.stringify(publicNull.json.data).includes('updatedBy'), false);

    const invalidUuid = await api('/api/v1/admin/settings/homepage-featured-artist', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: 'not-a-uuid' },
    });
    assert.equal(invalidUuid.status, 400);

    const missing = await api('/api/v1/admin/settings/homepage-featured-artist', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: missingArtistId },
    });
    assert.equal(missing.status, 404);

    const draft = await api('/api/v1/admin/artists', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        name: `Draft featured ${suffix}`,
        slug: `draft-featured-${suffix}`,
      },
    });
    assert.equal(draft.status, 201, JSON.stringify(draft.json));
    createdIds.push(draft.json.data.id);

    const draftRejected = await api('/api/v1/admin/settings/homepage-featured-artist', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: draft.json.data.id },
    });
    assert.equal(draftRejected.status, 400);

    const publishedName = `Published featured ${suffix}`;
    const published = await api('/api/v1/admin/artists', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        name: publishedName,
        slug: `published-featured-${suffix}`,
        status: 'published',
        shortBio: 'A painter of quiet afternoons.',
        biography: 'There was once a meadow. Light fell across the grass.',
        location: 'Goa',
        profileImageAlt: `Portrait of ${publishedName}`,
      },
    });
    assert.equal(published.status, 201, JSON.stringify(published.json));
    createdIds.push(published.json.data.id);
    const publishedId = published.json.data.id;

    const featured = await api('/api/v1/admin/settings/homepage-featured-artist', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: publishedId },
    });
    assert.equal(featured.status, 200);
    assert.equal(featured.json.data.artistId, publishedId);
    assert.ok(featured.json.data.updatedAt);
    assert.equal('updatedBy' in featured.json.data, false);

    const publicFeatured = await api('/api/v1/homepage/featured-artist');
    assert.equal(publicFeatured.status, 200);
    assertPublicFeaturedEnvelope(publicFeatured.json.data);
    assertPublicFeaturedArtistDto(publicFeatured.json.data.artist);
    assert.equal(publicFeatured.json.data.artist.id, publishedId);
    assert.equal(publicFeatured.json.data.artist.name, publishedName);
    assert.equal(publicFeatured.json.data.artist.slug, `published-featured-${suffix}`);
    assert.equal(publicFeatured.json.data.artist.shortBio, 'A painter of quiet afternoons.');
    assert.equal(publicFeatured.json.data.artist.biography, 'There was once a meadow. Light fell across the grass.');
    assert.equal(publicFeatured.json.data.artist.location, 'Goa');
    assert.equal(publicFeatured.json.data.artist.profileImageAlt, `Portrait of ${publishedName}`);
    assert.equal(JSON.stringify(publicFeatured.json.data).includes(foundAdmin.user_id), false);
    assert.equal(JSON.stringify(publicFeatured.json.data).includes('"status"'), false);
    assert.equal(JSON.stringify(publicFeatured.json.data).includes('"artworks"'), false);

    const upserted = await api('/api/v1/admin/settings/homepage-featured-artist', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: publishedId },
    });
    assert.equal(upserted.status, 200);
    assert.equal(upserted.json.data.artistId, publishedId);

    const unpublished = await api(`/api/v1/admin/artists/${publishedId}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'draft' },
    });
    assert.equal(unpublished.status, 200);

    const publicUnpublished = await api('/api/v1/homepage/featured-artist');
    assert.equal(publicUnpublished.status, 200);
    assert.equal(publicUnpublished.json.data.artist, null);
    assertPublicFeaturedEnvelope(publicUnpublished.json.data);
    assert.equal(JSON.stringify(publicUnpublished.json.data).includes(publishedName), false);
    assert.equal(JSON.stringify(publicUnpublished.json.data).includes('draft'), false);

    const adminStillPinned = await api('/api/v1/admin/settings/homepage-featured-artist', {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(adminStillPinned.status, 200);
    assert.equal(adminStillPinned.json.data.artistId, publishedId);

    const republished = await api(`/api/v1/admin/artists/${publishedId}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'published' },
    });
    assert.equal(republished.status, 200);

    const deleted = await api(`/api/v1/admin/artists/${publishedId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(deleted.status, 200);
    createdIds.pop();

    const publicDeleted = await api('/api/v1/homepage/featured-artist');
    assert.equal(publicDeleted.status, 200);
    assert.equal(publicDeleted.json.data.artist, null);
    assertPublicFeaturedEnvelope(publicDeleted.json.data);
    assert.equal(JSON.stringify(publicDeleted.json.data).includes(publishedName), false);

    const [last] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'settings.homepage_featured_artist.update'))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    assert.ok(last);
    assert.equal(last.entityType, 'app_settings');
    assert.equal(last.metadata?.key, APP_SETTING_HOMEPAGE_FEATURED_ARTIST);
  } finally {
    for (const id of createdIds.reverse()) {
      await api(`/api/v1/admin/artists/${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer admin-token' },
      });
    }
    await api('/api/v1/admin/settings/homepage-featured-artist', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artistId: previous.json.data.artistId },
    });
  }
});
