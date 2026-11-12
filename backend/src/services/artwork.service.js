import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  artists,
  artworkCategories,
  artworkImages,
  artworkMedia,
  artworks,
  collectionArtworks,
  orderItems,
  orders,
} from '../db/schema/index.js';
import { mapArtistSummary, resolveArtworkArtistAssociation } from '../lib/artist-association.js';
import {
  assertCanPublish,
  assertImageCapacity,
  assertImageFileAgainstConstraints,
  assertPrimaryBelongsToArtwork,
  assertReorderPayload,
  assertStoragePathForArtwork,
  nextDisplayOrder,
  replacementPrimaryId,
  sortArtworkImages,
} from '../lib/artwork-images.js';
import { ApiError } from '../utils/ApiError.js';
import { uniqueSlug } from '../utils/slug.js';
import { writeAuditLog } from './audit.service.js';
import { getActiveReservedQuantities, withAvailability } from './inventory.service.js';
import { getArtworkImagesUploadConstraints } from './storage-constraints.service.js';

const PUBLIC_STATUSES = ['published'];
const PURCHASED_ORDER_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'];

function mapArtworkRow(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    story: row.story,
    technique: row.technique,
    medium: row.medium,
    material: row.material,
    artistName: row.artistName,
    artistId: row.artistId,
    yearCreated: row.yearCreated,
    width: row.width,
    height: row.height,
    depth: row.depth,
    dimensionUnit: row.dimensionUnit,
    pricePaise: row.pricePaise,
    currency: row.currency,
    inventoryQuantity: row.inventoryQuantity,
    status: row.status,
    isFeatured: row.isFeatured,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function attachRelations(artworkRows, { includePrivateMedia = false } = {}) {
  if (artworkRows.length === 0) {
    return [];
  }

  const artworkIds = artworkRows.map((row) => row.id);
  const reservedMap = await getActiveReservedQuantities(artworkIds);

  const [images, media, categoryRows, collectionRows] = await Promise.all([
    db.select().from(artworkImages).where(inArray(artworkImages.artworkId, artworkIds)),
    db.select().from(artworkMedia).where(inArray(artworkMedia.artworkId, artworkIds)),
    db.select().from(artworkCategories).where(inArray(artworkCategories.artworkId, artworkIds)),
    db.select().from(collectionArtworks).where(inArray(collectionArtworks.artworkId, artworkIds)),
  ]);

  const artistIds = [...new Set(artworkRows.map((row) => row.artistId).filter(Boolean))];
  const artistRows = artistIds.length > 0
    ? await db.select().from(artists).where(inArray(artists.id, artistIds))
    : [];
  const artistsById = new Map(artistRows.map((row) => [row.id, row]));

  return artworkRows.map((row) => {
    const artwork = withAvailability(mapArtworkRow(row), reservedMap.get(row.id) || 0);
    artwork.artist = mapArtistSummary(artistsById.get(row.artistId), {
      publicOnly: !includePrivateMedia,
    });
    if (!artwork.artist) {
      artwork.artistId = includePrivateMedia ? row.artistId : null;
    }
    artwork.images = sortArtworkImages(
      images.filter((image) => image.artworkId === row.id),
    );
    artwork.media = media
      .filter((item) => item.artworkId === row.id)
      .filter((item) => includePrivateMedia || item.accessLevel === 'public')
      .sort((a, b) => a.displayOrder - b.displayOrder);
    artwork.categoryIds = categoryRows
      .filter((item) => item.artworkId === row.id)
      .map((item) => item.categoryId);
    artwork.collectionIds = collectionRows
      .filter((item) => item.artworkId === row.id)
      .map((item) => item.collectionId);
    return artwork;
  });
}

async function replaceArtworkLinks(artworkId, { categoryIds, collectionIds } = {}) {
  if (categoryIds) {
    await db.delete(artworkCategories).where(eq(artworkCategories.artworkId, artworkId));
    if (categoryIds.length > 0) {
      await db.insert(artworkCategories).values(
        categoryIds.map((categoryId) => ({ artworkId, categoryId })),
      );
    }
  }

  if (collectionIds) {
    await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(collectionArtworks)
        .where(eq(collectionArtworks.artworkId, artworkId));
      const existingByCollection = new Map(existingRows.map((row) => [row.collectionId, row]));
      const nextIds = [...new Set(collectionIds)];

      await tx.delete(collectionArtworks).where(eq(collectionArtworks.artworkId, artworkId));
      if (nextIds.length === 0) {
        return;
      }

      const values = [];
      for (const collectionId of nextIds) {
        const existing = existingByCollection.get(collectionId);
        let displayOrder = existing?.displayOrder;
        if (displayOrder == null) {
          const [maxRow] = await tx
            .select({
              maxOrder: sql`coalesce(max(${collectionArtworks.displayOrder}), -1)::int`.as('maxOrder'),
            })
            .from(collectionArtworks)
            .where(eq(collectionArtworks.collectionId, collectionId));
          displayOrder = Number(maxRow?.maxOrder ?? -1) + 1;
        }
        values.push({ artworkId, collectionId, displayOrder });
      }
      await tx.insert(collectionArtworks).values(values);
    });
  }
}

export async function listArtworks(query, { publicOnly = true } = {}) {
  const filters = [];

  if (publicOnly) {
    filters.push(inArray(artworks.status, PUBLIC_STATUSES));
  } else if (query.status) {
    filters.push(eq(artworks.status, query.status));
  }

  if (query.q) {
    const pattern = `%${query.q}%`;
    filters.push(or(
      ilike(artworks.title, pattern),
      ilike(artworks.artistName, pattern),
      ilike(artworks.description, pattern),
    ));
  }

  if (query.minPricePaise !== undefined) {
    filters.push(gte(artworks.pricePaise, query.minPricePaise));
  }

  if (query.maxPricePaise !== undefined) {
    filters.push(lte(artworks.pricePaise, query.maxPricePaise));
  }

  if (query.featured === 'true') {
    filters.push(eq(artworks.isFeatured, true));
  }

  let source = query.collectionId
    ? db.select({ artwork: artworks, displayOrder: collectionArtworks.displayOrder }).from(artworks)
    : db.select({ artwork: artworks }).from(artworks);

  if (query.categoryId) {
    source = source.innerJoin(
      artworkCategories,
      eq(artworkCategories.artworkId, artworks.id),
    );
    filters.push(eq(artworkCategories.categoryId, query.categoryId));
  }

  if (query.collectionId) {
    source = source.innerJoin(
      collectionArtworks,
      eq(collectionArtworks.artworkId, artworks.id),
    );
    filters.push(eq(collectionArtworks.collectionId, query.collectionId));
  }

  if (query.artistId) {
    filters.push(eq(artworks.artistId, query.artistId));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  const [countRow] = await db
    .select({ count: sql`count(distinct ${artworks.id})::int`.as('count') })
    .from(artworks)
    .leftJoin(artworkCategories, eq(artworkCategories.artworkId, artworks.id))
    .leftJoin(collectionArtworks, eq(collectionArtworks.artworkId, artworks.id))
    .where(whereClause);

  const rows = await source
    .where(whereClause)
    .orderBy(
      ...(query.collectionId
        ? [asc(collectionArtworks.displayOrder), asc(artworks.id)]
        : [desc(artworks.createdAt)]),
    )
    .limit(limit)
    .offset(offset);

  const uniqueArtworks = [];
  const seen = new Set();
  for (const row of rows) {
    const artwork = row.artwork || row;
    if (!seen.has(artwork.id)) {
      seen.add(artwork.id);
      uniqueArtworks.push(artwork);
    }
  }

  const items = await attachRelations(uniqueArtworks, { includePrivateMedia: !publicOnly });

  return {
    items,
    page,
    limit,
    total: Number(countRow?.count || 0),
  };
}

export async function getArtworkById(artworkId, { publicOnly = true, includePrivateMedia = false } = {}) {
  const [row] = await db.select().from(artworks).where(eq(artworks.id, artworkId)).limit(1);
  if (!row || (publicOnly && !PUBLIC_STATUSES.includes(row.status))) {
    throw new ApiError(404, 'Artwork not found');
  }

  const [item] = await attachRelations([row], { includePrivateMedia: includePrivateMedia || !publicOnly });
  return item;
}

export async function userHasPurchasedArtwork(userId, artworkId) {
  const [row] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(
      eq(orderItems.artworkId, artworkId),
      eq(orders.userId, userId),
      inArray(orders.status, PURCHASED_ORDER_STATUSES),
    ))
    .limit(1);

  return Boolean(row);
}

async function listArtworkImageRows(artworkId) {
  return db.select().from(artworkImages).where(eq(artworkImages.artworkId, artworkId));
}

async function compactArtworkImageOrder(artworkId, images) {
  const ordered = sortArtworkImages(images);
  await Promise.all(ordered.map((image, index) => (
    db.update(artworkImages)
      .set({ displayOrder: index })
      .where(eq(artworkImages.id, image.id))
  )));
}

async function setArtworkPrimaryImage(artworkId, primaryImageId) {
  if (!primaryImageId) {
    return;
  }
  await db.update(artworkImages)
    .set({ isPrimary: false })
    .where(eq(artworkImages.artworkId, artworkId));
  await db.update(artworkImages)
    .set({ isPrimary: true })
    .where(and(
      eq(artworkImages.artworkId, artworkId),
      eq(artworkImages.id, primaryImageId),
    ));
}

async function assertArtworkCanBePublished(artworkId, status) {
  if (status !== 'published') {
    return;
  }
  const images = await listArtworkImageRows(artworkId);
  assertCanPublish(status, images.length);
}

export async function createArtwork(payload, actorUserId) {
  assertCanPublish(payload.status || 'draft', 0);
  const association = await resolveArtworkArtistAssociation(payload);
  const artistName = association.artistName || payload.artistName;
  if (!artistName) {
    throw new ApiError(400, 'An artist name or a published artist is required.');
  }
  const slug = payload.slug || uniqueSlug(payload.title);
  const [created] = await db.insert(artworks).values({
    title: payload.title,
    slug,
    description: payload.description ?? null,
    story: payload.story ?? null,
    technique: payload.technique ?? null,
    medium: payload.medium ?? null,
    material: payload.material ?? null,
    artistName,
    artistId: association.artistId ?? null,
    yearCreated: payload.yearCreated ?? null,
    width: payload.width ?? null,
    height: payload.height ?? null,
    depth: payload.depth ?? null,
    dimensionUnit: payload.dimensionUnit ?? null,
    pricePaise: payload.pricePaise,
    currency: payload.currency || 'INR',
    inventoryQuantity: payload.inventoryQuantity ?? 1,
    status: payload.status || 'draft',
    isFeatured: payload.isFeatured ?? false,
  }).returning();

  await replaceArtworkLinks(created.id, {
    categoryIds: payload.categoryIds || [],
    collectionIds: payload.collectionIds || [],
  });
  await writeAuditLog({
    actorUserId,
    action: 'artwork.create',
    entityType: 'artwork',
    entityId: created.id,
  });

  return getArtworkById(created.id, { publicOnly: false, includePrivateMedia: true });
}

export async function updateArtwork(artworkId, payload, actorUserId) {
  const [existing] = await db.select().from(artworks).where(eq(artworks.id, artworkId)).limit(1);
  if (!existing) {
    throw new ApiError(404, 'Artwork not found');
  }

  const updates = { ...payload };
  delete updates.categoryIds;
  delete updates.collectionIds;
  if (Object.prototype.hasOwnProperty.call(payload, 'artistId')) {
    const association = await resolveArtworkArtistAssociation(payload, {
      existingArtistId: existing.artistId,
    });
    updates.artistId = association.artistId;
    if (association.artistName) {
      updates.artistName = association.artistName;
    }
  }
  const nextStatus = updates.status ?? existing.status;
  await assertArtworkCanBePublished(artworkId, nextStatus);

  if (Object.keys(updates).length > 0) {
    await db.update(artworks).set(updates).where(eq(artworks.id, artworkId));
  }

  if (payload.categoryIds || payload.collectionIds) {
    await replaceArtworkLinks(artworkId, {
      categoryIds: payload.categoryIds ?? undefined,
      collectionIds: payload.collectionIds ?? undefined,
    });
  }

  await writeAuditLog({
    actorUserId,
    action: 'artwork.update',
    entityType: 'artwork',
    entityId: artworkId,
  });

  return getArtworkById(artworkId, { publicOnly: false, includePrivateMedia: true });
}

export async function archiveArtwork(artworkId, actorUserId) {
  return updateArtwork(artworkId, { status: 'archived' }, actorUserId);
}

export async function addArtworkImage(artworkId, payload, actorUserId) {
  assertStoragePathForArtwork(artworkId, payload.storagePath);
  const constraints = await getArtworkImagesUploadConstraints();
  assertImageFileAgainstConstraints(payload, constraints);

  await getArtworkById(artworkId, { publicOnly: false, includePrivateMedia: true });
  const existing = await listArtworkImageRows(artworkId);
  assertImageCapacity(existing.length, 1);

  const isPrimary = existing.length === 0 ? true : Boolean(payload.isPrimary);
  if (isPrimary) {
    await db.update(artworkImages)
      .set({ isPrimary: false })
      .where(eq(artworkImages.artworkId, artworkId));
  }

  const [created] = await db.insert(artworkImages).values({
    artworkId,
    storagePath: payload.storagePath,
    altText: payload.altText ?? null,
    displayOrder: payload.displayOrder ?? nextDisplayOrder(existing),
    isPrimary,
  }).returning();

  await writeAuditLog({
    actorUserId,
    action: 'artwork.image.add',
    entityType: 'artwork',
    entityId: artworkId,
    metadata: { imageId: created.id },
  });

  return created;
}

export async function removeArtworkImage(artworkId, imageId, actorUserId) {
  await getArtworkById(artworkId, { publicOnly: false, includePrivateMedia: true });
  const existing = await listArtworkImageRows(artworkId);
  const target = existing.find((image) => image.id === imageId);
  if (!target) {
    throw new ApiError(404, 'Artwork image not found');
  }

  const nextPrimaryId = replacementPrimaryId(existing, imageId);
  await db.delete(artworkImages).where(and(
    eq(artworkImages.id, imageId),
    eq(artworkImages.artworkId, artworkId),
  ));

  const remaining = existing.filter((image) => image.id !== imageId);
  if (nextPrimaryId) {
    await setArtworkPrimaryImage(artworkId, nextPrimaryId);
  }
  await compactArtworkImageOrder(artworkId, remaining.map((image) => (
    image.id === nextPrimaryId ? { ...image, isPrimary: true } : image
  )));

  await writeAuditLog({
    actorUserId,
    action: 'artwork.image.remove',
    entityType: 'artwork',
    entityId: artworkId,
    metadata: { imageId, storagePath: target.storagePath },
  });

  return {
    removedId: imageId,
    storagePath: target.storagePath,
    images: sortArtworkImages(await listArtworkImageRows(artworkId)),
  };
}

export async function reorderArtworkImages(artworkId, payload, actorUserId) {
  await getArtworkById(artworkId, { publicOnly: false, includePrivateMedia: true });
  const existing = await listArtworkImageRows(artworkId);
  const existingIds = existing.map((image) => image.id);
  assertReorderPayload(existingIds, payload.imageIds);
  assertPrimaryBelongsToArtwork(existingIds, payload.primaryImageId);

  await db.transaction(async (tx) => {
    await Promise.all(payload.imageIds.map((imageId, index) => (
      tx.update(artworkImages)
        .set({ displayOrder: index })
        .where(and(
          eq(artworkImages.id, imageId),
          eq(artworkImages.artworkId, artworkId),
        ))
    )));

    if (payload.primaryImageId) {
      await tx.update(artworkImages)
        .set({ isPrimary: false })
        .where(eq(artworkImages.artworkId, artworkId));
      await tx.update(artworkImages)
        .set({ isPrimary: true })
        .where(and(
          eq(artworkImages.artworkId, artworkId),
          eq(artworkImages.id, payload.primaryImageId),
        ));
    }
  });

  await writeAuditLog({
    actorUserId,
    action: 'artwork.image.reorder',
    entityType: 'artwork',
    entityId: artworkId,
    metadata: {
      imageIds: payload.imageIds,
      primaryImageId: payload.primaryImageId || null,
    },
  });

  return sortArtworkImages(await listArtworkImageRows(artworkId));
}

export async function addArtworkMedia(artworkId, payload, actorUserId) {
  await getArtworkById(artworkId, { publicOnly: false, includePrivateMedia: true });

  const [created] = await db.insert(artworkMedia).values({
    artworkId,
    mediaType: payload.mediaType,
    storageBucket: payload.storageBucket,
    storagePath: payload.storagePath,
    originalFilename: payload.originalFilename ?? null,
    mimeType: payload.mimeType ?? null,
    fileSizeBytes: payload.fileSizeBytes ?? null,
    accessLevel: payload.accessLevel,
    displayOrder: payload.displayOrder ?? 0,
  }).returning();

  await writeAuditLog({
    actorUserId,
    action: 'artwork.media.add',
    entityType: 'artwork',
    entityId: artworkId,
    metadata: { mediaId: created.id, mediaType: created.mediaType },
  });

  return created;
}

export default {
  listArtworks,
  getArtworkById,
  userHasPurchasedArtwork,
  createArtwork,
  updateArtwork,
  archiveArtwork,
  addArtworkImage,
  removeArtworkImage,
  reorderArtworkImages,
  addArtworkMedia,
};
