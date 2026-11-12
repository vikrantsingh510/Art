import { asc, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { artworkImages, artworks, categories, collectionArtworks, collections } from '../db/schema/index.js';
import { assertCoverStoragePathForCollection } from '../lib/collection-cover.js';
import { ApiError } from '../utils/ApiError.js';
import { isUniqueViolation } from '../utils/pg-error.js';
import { slugify, uniqueSlug } from '../utils/slug.js';
import { writeAuditLog } from './audit.service.js';

export async function listCategories({ activeOnly = true } = {}) {
  const query = db.select().from(categories).orderBy(desc(categories.createdAt));
  if (activeOnly) {
    return query.where(eq(categories.isActive, true));
  }
  return query;
}

export async function createCategory(payload, actorUserId) {
  const [created] = await db.insert(categories).values({
    name: payload.name,
    slug: payload.slug || uniqueSlug(payload.name),
    description: payload.description ?? null,
    isActive: payload.isActive ?? true,
  }).returning();

  await writeAuditLog({
    actorUserId,
    action: 'category.create',
    entityType: 'category',
    entityId: created.id,
  });

  return created;
}

export async function updateCategory(categoryId, payload, actorUserId) {
  const [existing] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!existing) {
    throw new ApiError(404, 'Category not found');
  }

  const [updated] = await db.update(categories).set(payload).where(eq(categories.id, categoryId)).returning();
  await writeAuditLog({
    actorUserId,
    action: 'category.update',
    entityType: 'category',
    entityId: categoryId,
  });
  return updated;
}

function mapCollection(row, extras = {}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    coverImagePath: row.coverImagePath,
    isPublished: row.isPublished,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extras,
  };
}

function resolveCollectionSlug(name, requestedSlug) {
  if (requestedSlug) {
    return slugify(requestedSlug);
  }
  return slugify(name);
}

async function getCollectionRow(collectionId) {
  const [row] = await db.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
  if (!row) {
    throw new ApiError(404, 'Collection not found');
  }
  return row;
}

async function countCollectionArtworks(collectionIds) {
  if (collectionIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      collectionId: collectionArtworks.collectionId,
      artworkCount: count(),
    })
    .from(collectionArtworks)
    .where(inArray(collectionArtworks.collectionId, collectionIds))
    .groupBy(collectionArtworks.collectionId);
  return new Map(rows.map((row) => [row.collectionId, Number(row.artworkCount || 0)]));
}

async function loadCollectionMembers(collectionId) {
  const members = await db
    .select({
      displayOrder: collectionArtworks.displayOrder,
      artwork: artworks,
    })
    .from(collectionArtworks)
    .innerJoin(artworks, eq(artworks.id, collectionArtworks.artworkId))
    .where(eq(collectionArtworks.collectionId, collectionId))
    .orderBy(asc(collectionArtworks.displayOrder), asc(artworks.id));

  const artworkIds = members.map((member) => member.artwork.id);
  const images = artworkIds.length > 0
    ? await db.select().from(artworkImages).where(inArray(artworkImages.artworkId, artworkIds))
    : [];
  const imagesByArtwork = new Map();
  for (const image of images) {
    const current = imagesByArtwork.get(image.artworkId) || [];
    current.push(image);
    imagesByArtwork.set(image.artworkId, current);
  }

  return members.map((member) => {
    const artworkImagesForLot = [...(imagesByArtwork.get(member.artwork.id) || [])]
      .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
    const primary = artworkImagesForLot.find((image) => image.isPrimary) || artworkImagesForLot[0] || null;
    return {
      id: member.artwork.id,
      title: member.artwork.title,
      artistName: member.artwork.artistName,
      status: member.artwork.status,
      displayOrder: member.displayOrder,
      storagePath: primary?.storagePath || null,
    };
  });
}

export async function listCollections({ publishedOnly = true, includeCounts = false } = {}) {
  const query = db.select().from(collections).orderBy(desc(collections.updatedAt), desc(collections.createdAt));
  const rows = publishedOnly
    ? await query.where(eq(collections.isPublished, true))
    : await query;
  if (!includeCounts) {
    return rows.map((row) => mapCollection(row));
  }
  const counts = await countCollectionArtworks(rows.map((row) => row.id));
  return rows.map((row) => mapCollection(row, {
    artworkCount: counts.get(row.id) || 0,
  }));
}

export async function getCollectionById(collectionId, { publishedOnly = true, includeMembers = false } = {}) {
  const row = await getCollectionRow(collectionId);
  if (publishedOnly && !row.isPublished) {
    throw new ApiError(404, 'Collection not found');
  }

  const members = await loadCollectionMembers(collectionId);
  const visibleMembers = publishedOnly
    ? members.filter((member) => member.status === 'published')
    : members;

  return mapCollection(row, {
    artworkCount: publishedOnly ? visibleMembers.length : members.length,
    artworkIds: visibleMembers.map((member) => member.id),
    ...(includeMembers ? { artworks: visibleMembers } : {}),
  });
}

export async function createCollection(payload, actorUserId) {
  if (payload.coverImagePath) {
    throw new ApiError(400, 'Upload a cover after the collection is created.');
  }

  const values = {
    name: payload.name,
    slug: resolveCollectionSlug(payload.name, payload.slug),
    description: payload.description ?? null,
    coverImagePath: null,
    isPublished: payload.isPublished ?? false,
  };

  let created;
  try {
    [created] = await db.insert(collections).values(values).returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'A collection with this slug already exists.');
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId,
    action: 'collection.create',
    entityType: 'collection',
    entityId: created.id,
    metadata: { slug: created.slug, isPublished: created.isPublished },
  });

  return getCollectionById(created.id, { publishedOnly: false, includeMembers: true });
}

export async function updateCollection(collectionId, payload, actorUserId) {
  const existing = await getCollectionRow(collectionId);
  const updates = { ...payload };

  if (updates.slug) {
    updates.slug = slugify(updates.slug);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'coverImagePath') && updates.coverImagePath) {
    assertCoverStoragePathForCollection(collectionId, updates.coverImagePath);
  }

  let updated;
  try {
    [updated] = await db.update(collections).set(updates).where(eq(collections.id, collectionId)).returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'A collection with this slug already exists.');
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId,
    action: Object.prototype.hasOwnProperty.call(payload, 'isPublished')
      && payload.isPublished !== existing.isPublished
      ? (payload.isPublished ? 'collection.publish' : 'collection.unpublish')
      : 'collection.update',
    entityType: 'collection',
    entityId: collectionId,
    metadata: {
      slug: updated.slug,
      previousSlug: existing.slug,
      isPublished: updated.isPublished,
    },
  });

  return getCollectionById(collectionId, { publishedOnly: false, includeMembers: true });
}

export async function addArtworkToCollection(collectionId, payload, actorUserId) {
  await getCollectionRow(collectionId);
  const [artwork] = await db.select({ id: artworks.id }).from(artworks).where(eq(artworks.id, payload.artworkId)).limit(1);
  if (!artwork) {
    throw new ApiError(400, 'Artwork not found.');
  }

  const [created] = await db.insert(collectionArtworks).values({
    collectionId,
    artworkId: payload.artworkId,
    displayOrder: payload.displayOrder ?? 0,
  }).onConflictDoNothing().returning();

  await writeAuditLog({
    actorUserId,
    action: 'collection.artwork.add',
    entityType: 'collection',
    entityId: collectionId,
    metadata: { artworkId: payload.artworkId },
  });

  return created || { collectionId, artworkId: payload.artworkId, displayOrder: payload.displayOrder ?? 0 };
}

export async function replaceCollectionArtworks(collectionId, artworkIds, actorUserId) {
  await getCollectionRow(collectionId);

  const uniqueIds = [...new Set(artworkIds)];
  if (uniqueIds.length !== artworkIds.length) {
    throw new ApiError(400, 'Artwork associations cannot contain duplicate ids.');
  }

  if (uniqueIds.length > 0) {
    const rows = await db
      .select({ id: artworks.id })
      .from(artworks)
      .where(inArray(artworks.id, uniqueIds));
    if (rows.length !== uniqueIds.length) {
      throw new ApiError(400, 'One or more artworks were not found.');
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(collectionArtworks).where(eq(collectionArtworks.collectionId, collectionId));
    if (uniqueIds.length > 0) {
      await tx.insert(collectionArtworks).values(
        uniqueIds.map((artworkId, index) => ({
          collectionId,
          artworkId,
          displayOrder: index,
        })),
      );
    }
  });

  await writeAuditLog({
    actorUserId,
    action: 'collection.artworks.replace',
    entityType: 'collection',
    entityId: collectionId,
    metadata: { artworkIds: uniqueIds },
  });

  return getCollectionById(collectionId, { publishedOnly: false, includeMembers: true });
}

export default {
  listCategories,
  createCategory,
  updateCategory,
  listCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  addArtworkToCollection,
  replaceCollectionArtworks,
};
