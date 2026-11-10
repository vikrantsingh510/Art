import { desc, eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { categories, collectionArtworks, collections } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { uniqueSlug } from '../utils/slug.js';
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

export async function listCollections({ publishedOnly = true } = {}) {
  const query = db.select().from(collections).orderBy(desc(collections.createdAt));
  if (publishedOnly) {
    return query.where(eq(collections.isPublished, true));
  }
  return query;
}

export async function getCollectionById(collectionId, { publishedOnly = true } = {}) {
  const [row] = await db.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
  if (!row || (publishedOnly && !row.isPublished)) {
    throw new ApiError(404, 'Collection not found');
  }

  const members = await db
    .select()
    .from(collectionArtworks)
    .where(eq(collectionArtworks.collectionId, collectionId));

  return {
    ...row,
    artworkIds: members
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => item.artworkId),
  };
}

export async function createCollection(payload, actorUserId) {
  const [created] = await db.insert(collections).values({
    name: payload.name,
    slug: payload.slug || uniqueSlug(payload.name),
    description: payload.description ?? null,
    coverImagePath: payload.coverImagePath ?? null,
    isPublished: payload.isPublished ?? false,
  }).returning();

  await writeAuditLog({
    actorUserId,
    action: 'collection.create',
    entityType: 'collection',
    entityId: created.id,
  });

  return created;
}

export async function updateCollection(collectionId, payload, actorUserId) {
  const [existing] = await db.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
  if (!existing) {
    throw new ApiError(404, 'Collection not found');
  }

  const [updated] = await db.update(collections).set(payload).where(eq(collections.id, collectionId)).returning();
  await writeAuditLog({
    actorUserId,
    action: 'collection.update',
    entityType: 'collection',
    entityId: collectionId,
  });
  return updated;
}

export async function addArtworkToCollection(collectionId, payload, actorUserId) {
  await getCollectionById(collectionId, { publishedOnly: false });
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

export default {
  listCategories,
  createCategory,
  updateCategory,
  listCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  addArtworkToCollection,
};
