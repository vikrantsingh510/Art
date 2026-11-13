import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { eq, inArray } from 'drizzle-orm';
import { client, db } from '../src/config/database.js';
import { artworks, blogs } from '../src/db/schema/index.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { uniqueSlug } from '../src/utils/slug.js';
import { api, stopTestServer } from './helpers/http.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const missingArtworkId = '99999999-9999-4999-8999-999999999999';

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

async function blogsReady() {
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    return false;
  }
  const response = await api('/api/v1/blogs');
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

test('journal related artworks batch through getArtworksByIds instead of per-item getArtworkById', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/blog.service.js'), 'utf8');
  const hydrateStart = source.indexOf('export async function hydrateArtworks');
  const getRowStart = source.indexOf('async function getBlogRow');
  const hydrateSource = source.slice(hydrateStart, getRowStart);

  assert.match(hydrateSource, /getArtworksByIds/);
  assert.match(hydrateSource, /loadArtworksByIds/);
  assert.match(hydrateSource, /orderBy\(asc\(blogArtworks\.displayOrder\)\)/);
  assert.doesNotMatch(hydrateSource, /getArtworkById/);
  assert.doesNotMatch(hydrateSource, /for \(const link of links\)/);
});

test('journal related artwork batching preserves order, omits missing and unpublished, and keeps public visibility', async (t) => {
  if (!await blogsReady()) {
    t.skip('database or journal schema is not reachable from this environment');
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
  const suffix = uniqueSlug('journal-hydrate');
  const artworkIds = [];
  let blogId = null;

  try {
    const created = await api('/api/v1/admin/blogs', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        title: `Hydrate ${suffix}`,
        slug: `hydrate-${suffix}`,
        body: 'Related works stay in editorial order.',
        status: 'published',
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    blogId = created.json.data.id;
    assert.deepEqual(created.json.data.artworks, []);

    const emptyPublic = await api(`/api/v1/blogs/hydrate-${suffix}`);
    assert.equal(emptyPublic.status, 200);
    assert.deepEqual(emptyPublic.json.data.artworks, []);
    assert.equal(Object.hasOwn(emptyPublic.json.data, 'body'), true);
    assert.equal(Object.hasOwn(emptyPublic.json.data, 'publishedAt'), true);

    const first = await insertArtwork('published', `First ${suffix}`);
    const second = await insertArtwork('published', `Second ${suffix}`);
    const third = await insertArtwork('published', `Third ${suffix}`);
    const draftWork = await insertArtwork('draft', `Draft ${suffix}`);
    artworkIds.push(first.id, second.id, third.id, draftWork.id);

    const one = await api(`/api/v1/admin/blogs/${blogId}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [second.id] },
    });
    assert.equal(one.status, 200, JSON.stringify(one.json));
    assert.deepEqual((one.json.data.artworks || []).map((item) => item.id), [second.id]);

    const onePublic = await api(`/api/v1/blogs/hydrate-${suffix}`);
    assert.equal(onePublic.status, 200);
    assert.deepEqual((onePublic.json.data.artworks || []).map((item) => item.id), [second.id]);

    const many = await api(`/api/v1/admin/blogs/${blogId}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [third.id, first.id, second.id] },
    });
    assert.equal(many.status, 200, JSON.stringify(many.json));
    assert.deepEqual(
      (many.json.data.artworks || []).map((item) => item.id),
      [third.id, first.id, second.id],
    );

    const manyPublic = await api(`/api/v1/blogs/hydrate-${suffix}`);
    assert.equal(manyPublic.status, 200);
    assert.deepEqual(
      (manyPublic.json.data.artworks || []).map((item) => item.id),
      [third.id, first.id, second.id],
    );
    assert.equal(manyPublic.json.data.artworks[0].title, third.title);
    assert.equal(Array.isArray(manyPublic.json.data.artworks[0].images), true);

    await db.update(artworks).set({ status: 'draft' }).where(eq(artworks.id, first.id));
    const afterUnpublish = await api(`/api/v1/blogs/hydrate-${suffix}`);
    assert.equal(afterUnpublish.status, 200);
    assert.deepEqual(
      (afterUnpublish.json.data.artworks || []).map((item) => item.id),
      [third.id, second.id],
    );

    const adminAfterUnpublish = await api(`/api/v1/admin/blogs/${blogId}`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(adminAfterUnpublish.status, 200);
    assert.deepEqual(adminAfterUnpublish.json.data.artworkIds, [third.id, first.id, second.id]);
    assert.deepEqual(
      (adminAfterUnpublish.json.data.artworks || []).map((item) => item.id),
      [third.id, first.id, second.id],
    );

    await db.delete(artworks).where(eq(artworks.id, second.id));
    artworkIds.splice(artworkIds.indexOf(second.id), 1);
    const afterMissing = await api(`/api/v1/blogs/hydrate-${suffix}`);
    assert.equal(afterMissing.status, 200);
    assert.deepEqual(
      (afterMissing.json.data.artworks || []).map((item) => item.id),
      [third.id],
    );

    const rejectMissing = await api(`/api/v1/admin/blogs/${blogId}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [third.id, missingArtworkId] },
    });
    assert.equal(rejectMissing.status, 400);

    const rejectDraft = await api(`/api/v1/admin/blogs/${blogId}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [draftWork.id] },
    });
    assert.equal(rejectDraft.status, 400);

    const unpublished = await api(`/api/v1/admin/blogs/${blogId}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'draft' },
    });
    assert.equal(unpublished.status, 200);
    const hidden = await api(`/api/v1/blogs/hydrate-${suffix}`);
    assert.equal(hidden.status, 404);
  } finally {
    if (blogId) {
      await db.delete(blogs).where(eq(blogs.id, blogId));
    }
    if (artworkIds.length > 0) {
      await db.delete(artworks).where(inArray(artworks.id, artworkIds));
    }
  }
});
