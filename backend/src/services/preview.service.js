import { and, desc, eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { artworkPreviews } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { getArtworkById } from './artwork.service.js';

export async function listArtworkPreviews(artworkId, { userId, isAdmin = false } = {}) {
  await getArtworkById(artworkId, { publicOnly: !isAdmin, includePrivateMedia: isAdmin });

  const filters = [eq(artworkPreviews.artworkId, artworkId)];
  if (!isAdmin) {
    filters.push(eq(artworkPreviews.userId, userId));
  }

  return db
    .select()
    .from(artworkPreviews)
    .where(and(...filters))
    .orderBy(desc(artworkPreviews.createdAt));
}

export async function createArtworkPreview(artworkId, userId, payload) {
  await getArtworkById(artworkId, { publicOnly: true });

  const [created] = await db.insert(artworkPreviews).values({
    artworkId,
    userId,
    storagePath: payload.storagePath,
    roomMetadata: payload.roomMetadata ?? null,
  }).returning();

  return created;
}

export async function getPreviewById(previewId, { userId, isAdmin = false } = {}) {
  const [row] = await db.select().from(artworkPreviews).where(eq(artworkPreviews.id, previewId)).limit(1);
  if (!row) {
    throw new ApiError(404, 'Preview not found');
  }

  if (!isAdmin && row.userId !== userId) {
    throw new ApiError(403, 'Preview access denied');
  }

  return row;
}

export default {
  listArtworkPreviews,
  createArtworkPreview,
  getPreviewById,
};
