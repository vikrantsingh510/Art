import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { artworks, blogArtworks, blogs } from '../db/schema/index.js';
import { assertCoverStoragePathForBlog } from '../lib/blog-cover.js';
import { ApiError } from '../utils/ApiError.js';
import { isUniqueViolation } from '../utils/pg-error.js';
import { slugify, uniqueSlug } from '../utils/slug.js';
import { getArtworkById } from './artwork.service.js';
import { writeAuditLog } from './audit.service.js';

function mapListItem(row, { includeAdminFields = false } = {}) {
  const item = {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverImagePath: row.coverImagePath,
    coverAltText: row.coverAltText,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    publishedAt: row.publishedAt,
  };

  if (includeAdminFields) {
    item.status = row.status;
    item.createdAt = row.createdAt;
    item.updatedAt = row.updatedAt;
  }

  return item;
}

function assertCanPublish(blog) {
  if (!String(blog.title || '').trim()) {
    throw new ApiError(400, 'A title is required to publish a journal entry.');
  }
  if (!String(blog.slug || '').trim()) {
    throw new ApiError(400, 'A slug is required to publish a journal entry.');
  }
  if (!String(blog.body || '').trim()) {
    throw new ApiError(400, 'Body copy is required to publish a journal entry.');
  }
}

function nextPublishedAt(existing, nextStatus) {
  if (nextStatus !== 'published') {
    return existing?.publishedAt ?? null;
  }
  return existing?.publishedAt || new Date();
}

function resolveSlug(title, requestedSlug) {
  if (requestedSlug) {
    return slugify(requestedSlug);
  }
  return uniqueSlug(title);
}

async function hydrateArtworks(blogId, { publicOnly = true } = {}) {
  const links = await db
    .select()
    .from(blogArtworks)
    .where(eq(blogArtworks.blogId, blogId))
    .orderBy(asc(blogArtworks.displayOrder));

  const artworkIds = links.map((link) => link.artworkId);
  const items = [];

  for (const link of links) {
    try {
      const artwork = await getArtworkById(link.artworkId, {
        publicOnly,
        includePrivateMedia: !publicOnly,
      });
      items.push(artwork);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        continue;
      }
      throw error;
    }
  }

  return { artworkIds, artworks: items };
}

async function getBlogRow(blogId) {
  const [row] = await db.select().from(blogs).where(eq(blogs.id, blogId)).limit(1);
  if (!row) {
    throw new ApiError(404, 'Journal entry not found');
  }
  return row;
}

async function toAdminBlog(row) {
  const { artworkIds, artworks: related } = await hydrateArtworks(row.id, { publicOnly: false });
  return {
    ...row,
    artworkIds,
    artworks: related,
  };
}

async function toPublicBlog(row) {
  const { artworks: related } = await hydrateArtworks(row.id, { publicOnly: true });
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    coverImagePath: row.coverImagePath,
    coverAltText: row.coverAltText,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    publishedAt: row.publishedAt,
    artworks: related,
  };
}

export async function listPublicBlogs(query = {}) {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;
  const whereClause = eq(blogs.status, 'published');

  const [countRow] = await db
    .select({ count: sql`count(*)::int`.as('count') })
    .from(blogs)
    .where(whereClause);

  const rows = await db
    .select()
    .from(blogs)
    .where(whereClause)
    .orderBy(desc(blogs.publishedAt), desc(blogs.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((row) => mapListItem(row)),
    page,
    limit,
    total: Number(countRow?.count || 0),
  };
}

export async function getPublicBlogBySlug(slug) {
  const [row] = await db.select().from(blogs).where(eq(blogs.slug, slug)).limit(1);
  if (!row || row.status !== 'published') {
    throw new ApiError(404, 'Journal entry not found');
  }
  return toPublicBlog(row);
}

export async function listAdminBlogs(query = {}) {
  const filters = [];
  if (query.status) {
    filters.push(eq(blogs.status, query.status));
  }
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(or(ilike(blogs.title, term), ilike(blogs.slug, term)));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  const [countRow] = await db
    .select({ count: sql`count(*)::int`.as('count') })
    .from(blogs)
    .where(whereClause);

  const rows = await db
    .select()
    .from(blogs)
    .where(whereClause)
    .orderBy(desc(blogs.updatedAt), desc(blogs.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((row) => mapListItem(row, { includeAdminFields: true })),
    page,
    limit,
    total: Number(countRow?.count || 0),
  };
}

export async function getAdminBlogById(blogId) {
  const row = await getBlogRow(blogId);
  return toAdminBlog(row);
}

export async function createBlog(payload, actorUserId) {
  const status = payload.status || 'draft';
  const slug = resolveSlug(payload.title, payload.slug);
  const values = {
    title: payload.title,
    slug,
    excerpt: payload.excerpt ?? null,
    body: payload.body ?? '',
    coverImagePath: payload.coverImagePath ?? null,
    coverAltText: payload.coverAltText ?? null,
    seoTitle: payload.seoTitle ?? null,
    seoDescription: payload.seoDescription ?? null,
    status,
    publishedAt: nextPublishedAt(null, status),
  };

  if (values.coverImagePath) {
    throw new ApiError(400, 'Upload a cover after the journal entry is created.');
  }

  if (status === 'published') {
    assertCanPublish(values);
  }

  let created;
  try {
    [created] = await db.insert(blogs).values(values).returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'A journal entry with this slug already exists.');
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId,
    action: 'blog.create',
    entityType: 'blog',
    entityId: created.id,
    metadata: { status: created.status, slug: created.slug },
  });

  return toAdminBlog(created);
}

export async function updateBlog(blogId, payload, actorUserId) {
  const existing = await getBlogRow(blogId);
  const updates = { ...payload };

  if (updates.slug) {
    updates.slug = slugify(updates.slug);
  }

  if (updates.coverImagePath) {
    assertCoverStoragePathForBlog(blogId, updates.coverImagePath);
  }

  const nextStatus = updates.status ?? existing.status;
  const merged = {
    ...existing,
    ...updates,
    status: nextStatus,
  };

  if (nextStatus === 'published') {
    assertCanPublish(merged);
  }

  updates.publishedAt = nextPublishedAt(existing, nextStatus);

  let updated;
  try {
    [updated] = await db.update(blogs).set(updates).where(eq(blogs.id, blogId)).returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'A journal entry with this slug already exists.');
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId,
    action: updates.status && updates.status !== existing.status
      ? (updates.status === 'published' ? 'blog.publish' : 'blog.unpublish')
      : 'blog.update',
    entityType: 'blog',
    entityId: blogId,
    metadata: {
      status: updated.status,
      slug: updated.slug,
      previousSlug: existing.slug,
    },
  });

  return toAdminBlog(updated);
}

export async function deleteBlog(blogId, actorUserId) {
  const existing = await getBlogRow(blogId);
  await db.delete(blogs).where(eq(blogs.id, blogId));
  await writeAuditLog({
    actorUserId,
    action: 'blog.delete',
    entityType: 'blog',
    entityId: blogId,
    metadata: { slug: existing.slug, status: existing.status },
  });
  return { id: blogId, deleted: true };
}

export async function replaceBlogArtworks(blogId, artworkIds, actorUserId) {
  await getBlogRow(blogId);

  const uniqueIds = [...new Set(artworkIds)];
  if (uniqueIds.length !== artworkIds.length) {
    throw new ApiError(400, 'Artwork associations cannot contain duplicate ids.');
  }

  if (uniqueIds.length > 0) {
    const rows = await db
      .select({ id: artworks.id, status: artworks.status })
      .from(artworks)
      .where(inArray(artworks.id, uniqueIds));

    if (rows.length !== uniqueIds.length) {
      throw new ApiError(400, 'One or more artworks were not found.');
    }

    const unpublished = rows.filter((row) => row.status !== 'published');
    if (unpublished.length > 0) {
      throw new ApiError(400, 'Only published artworks can be associated with a journal entry.');
    }
  }

  await db.delete(blogArtworks).where(eq(blogArtworks.blogId, blogId));
  if (uniqueIds.length > 0) {
    await db.insert(blogArtworks).values(
      uniqueIds.map((artworkId, index) => ({
        blogId,
        artworkId,
        displayOrder: index,
      })),
    );
  }

  await writeAuditLog({
    actorUserId,
    action: 'blog.artworks.replace',
    entityType: 'blog',
    entityId: blogId,
    metadata: { artworkIds: uniqueIds },
  });

  return getAdminBlogById(blogId);
}

export default {
  listPublicBlogs,
  getPublicBlogBySlug,
  listAdminBlogs,
  getAdminBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  replaceBlogArtworks,
};
