import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { client, db } from '../src/config/database.js';
import { artworks, auditLogs, blogs } from '../src/db/schema/index.js';
import { assertCoverStoragePathForBlog, blogCoverStoragePath } from '../src/lib/blog-cover.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { uniqueSlug } from '../src/utils/slug.js';
import { blogCreateBody, blogUpdateBody } from '../src/validators/blog.validators.js';
import { eq, ilike, or } from 'drizzle-orm';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';

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

async function cleanupBlog(blogId, artworkIds = []) {
  if (blogId) {
    await db.delete(blogs).where(eq(blogs.id, blogId));
  }
  for (const artworkId of artworkIds) {
    await db.delete(artworks).where(eq(artworks.id, artworkId));
  }
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('cover path helper stores under blogs/{blogId}/cover.{ext}', () => {
  const blogId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.equal(blogCoverStoragePath(blogId, 'hero.PNG'), `blogs/${blogId}/cover.png`);
  assert.doesNotThrow(() => assertCoverStoragePathForBlog(blogId, `blogs/${blogId}/cover.jpg`));
  assert.throws(
    () => assertCoverStoragePathForBlog(blogId, `${blogId}/cover.jpg`),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => assertCoverStoragePathForBlog(blogId, `blogs/${blogId}/../secret.jpg`),
    (error) => error.statusCode === 400,
  );
});

test('blog validators require a title and reject unknown statuses', () => {
  assert.equal(blogCreateBody.safeParse({ title: 'Atelier notes' }).success, true);
  assert.equal(blogCreateBody.safeParse({ title: '' }).success, false);
  assert.equal(blogCreateBody.safeParse({ title: 'Atelier notes', status: 'archived' }).success, false);
  assert.equal(blogUpdateBody.safeParse({}).success, true);
  assert.equal(blogUpdateBody.safeParse({ slug: 'Not A Slug' }).success, false);
});

test('customers cannot create journal entries', async () => {
  mockIdentity();
  const response = await api('/api/v1/admin/blogs', {
    method: 'POST',
    headers: { Authorization: 'Bearer customer-token' },
    body: { title: 'Forbidden journal' },
  });
  assert.equal(response.status, 403);
});

test('unauthenticated callers cannot list admin blogs', async () => {
  const response = await api('/api/v1/admin/blogs');
  assert.equal(response.status, 401);
});

test('blog drafts, publishing, slugs, artworks, deletion, visibility and audit logs', async (t) => {
  if (!await blogsReady()) {
    t.skip('database or blogs migration is not reachable from this environment');
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
  const suffix = uniqueSlug('journal');
  const createdIds = [];
  const artworkIds = [];

  try {
    const draft = await api('/api/v1/admin/blogs', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        title: `Draft ${suffix}`,
        slug: `draft-${suffix}`,
        body: 'A private atelier note.',
        excerpt: 'Not yet public.',
      },
    });
    assert.equal(draft.status, 201, JSON.stringify(draft.json));
    assert.equal(draft.json.data.status, 'draft');
    assert.equal(draft.json.data.publishedAt, null);
    createdIds.push(draft.json.data.id);

    const publicDraft = await api(`/api/v1/blogs/${draft.json.data.slug}`);
    assert.equal(publicDraft.status, 404);

    const publicListBefore = await api('/api/v1/blogs');
    assert.equal(publicListBefore.status, 200);
    assert.equal(
      (publicListBefore.json.data.items || []).some((item) => item.id === draft.json.data.id),
      false,
    );

    const emptyPublish = await api(`/api/v1/admin/blogs/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'published', body: '   ' },
    });
    assert.equal(emptyPublish.status, 400);

    const published = await api(`/api/v1/admin/blogs/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'published' },
    });
    assert.equal(published.status, 200);
    assert.equal(published.json.data.status, 'published');
    assert.ok(published.json.data.publishedAt);

    const firstPublishedAt = published.json.data.publishedAt;

    const publicDetail = await api(`/api/v1/blogs/${draft.json.data.slug}`);
    assert.equal(publicDetail.status, 200);
    assert.equal(publicDetail.json.data.title, `Draft ${suffix}`);
    assert.equal(publicDetail.json.data.body, 'A private atelier note.');

    const duplicate = await api('/api/v1/admin/blogs', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        title: `Copy ${suffix}`,
        slug: `draft-${suffix}`,
        body: 'Collision.',
      },
    });
    assert.equal(duplicate.status, 409);

    const unpublished = await api(`/api/v1/admin/blogs/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'draft' },
    });
    assert.equal(unpublished.status, 200);
    assert.equal(unpublished.json.data.status, 'draft');
    assert.equal(unpublished.json.data.publishedAt, firstPublishedAt);

    const hiddenAgain = await api(`/api/v1/blogs/${draft.json.data.slug}`);
    assert.equal(hiddenAgain.status, 404);

    const republished = await api(`/api/v1/admin/blogs/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { status: 'published' },
    });
    assert.equal(republished.json.data.publishedAt, firstPublishedAt);

    const renamed = await api(`/api/v1/admin/blogs/${draft.json.data.id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token' },
      body: { slug: `renamed-${suffix}` },
    });
    assert.equal(renamed.status, 200);
    const oldSlug = await api(`/api/v1/blogs/draft-${suffix}`);
    assert.equal(oldSlug.status, 404);
    const newSlug = await api(`/api/v1/blogs/renamed-${suffix}`);
    assert.equal(newSlug.status, 200);

    const publishedWork = await insertArtwork('published', `Published ${suffix}`);
    const draftWork = await insertArtwork('draft', `Draft work ${suffix}`);
    const soldWork = await insertArtwork('sold', `Sold ${suffix}`);
    artworkIds.push(publishedWork.id, draftWork.id, soldWork.id);

    const rejectDraftArtwork = await api(`/api/v1/admin/blogs/${draft.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [draftWork.id] },
    });
    assert.equal(rejectDraftArtwork.status, 400);

    const rejectSoldArtwork = await api(`/api/v1/admin/blogs/${draft.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [soldWork.id] },
    });
    assert.equal(rejectSoldArtwork.status, 400);

    const associate = await api(`/api/v1/admin/blogs/${draft.json.data.id}/artworks`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { artworkIds: [publishedWork.id] },
    });
    assert.equal(associate.status, 200);
    assert.deepEqual(associate.json.data.artworkIds, [publishedWork.id]);

    await db.update(artworks).set({ status: 'sold' }).where(eq(artworks.id, publishedWork.id));
    const publicAfterSold = await api(`/api/v1/blogs/renamed-${suffix}`);
    assert.equal(publicAfterSold.status, 200);
    assert.equal(publicAfterSold.json.data.artworks.length, 0);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, draft.json.data.id));
    const actions = logs.map((row) => row.action).sort();
    assert.equal(actions.includes('blog.create'), true);
    assert.equal(actions.includes('blog.publish'), true);
    assert.equal(actions.includes('blog.unpublish'), true);
    assert.equal(actions.includes('blog.artworks.replace'), true);

    const removed = await api(`/api/v1/admin/blogs/${draft.json.data.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(removed.status, 200);
    assert.equal(removed.json.data.deleted, true);

    const gone = await api(`/api/v1/admin/blogs/${draft.json.data.id}`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.equal(gone.status, 404);
    createdIds.length = 0;

    const deleteLogs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, draft.json.data.id));
    assert.equal(deleteLogs.some((row) => row.action === 'blog.delete'), true);
  } finally {
    await db.delete(blogs).where(or(
      ilike(blogs.slug, `%${suffix}%`),
      ilike(blogs.slug, 'debug-journal-%'),
    ));
    for (const id of createdIds) {
      await cleanupBlog(id);
    }
    await cleanupBlog(null, artworkIds);
  }
});
