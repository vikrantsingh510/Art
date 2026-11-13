import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { artists, artworkImages, artworks } from '../db/schema/index.js';
import { assertPortraitStoragePathForArtist } from '../lib/artist-portrait.js';
import { sortArtworkImages } from '../lib/artwork-images.js';
import { ApiError } from '../utils/ApiError.js';
import { isUniqueViolation } from '../utils/pg-error.js';
import { slugify, uniqueSlug } from '../utils/slug.js';
import { listArtworks } from './artwork.service.js';
import { getActiveReservedQuantities, withAvailability } from './inventory.service.js';
import { writeAuditLog } from './audit.service.js';

const PUBLIC_ARTWORK_STATUSES = ['published'];
const ARTIST_PUBLIC_ARTWORK_LIMIT = 100;

function mapListItem(row, { includeAdminFields = false } = {}) {
  const item = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortBio: row.shortBio,
    profileImagePath: row.profileImagePath,
    profileImageAlt: row.profileImageAlt,
    artisticStyle: row.artisticStyle,
    medium: row.medium,
    location: row.location,
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

function assertCanPublish(artist) {
  if (!String(artist.name || '').trim()) {
    throw new ApiError(400, 'A name is required to publish an artist.');
  }
  if (!String(artist.slug || '').trim()) {
    throw new ApiError(400, 'A slug is required to publish an artist.');
  }
}

function nextPublishedAt(existing, nextStatus) {
  if (nextStatus !== 'published') {
    return existing?.publishedAt ?? null;
  }
  return existing?.publishedAt || new Date();
}

function resolveSlug(name, requestedSlug) {
  if (requestedSlug) {
    return slugify(requestedSlug);
  }
  return uniqueSlug(name);
}

async function getArtistRecord(artistId) {
  const [row] = await db.select().from(artists).where(eq(artists.id, artistId)).limit(1);
  if (!row) {
    throw new ApiError(404, 'Artist not found');
  }
  return row;
}

async function hydrateArtworks(artistId, { publicOnly = true } = {}) {
  const data = await listArtworks(
    { artistId, limit: ARTIST_PUBLIC_ARTWORK_LIMIT },
    { publicOnly },
  );
  return data.items || [];
}

function toArtistArtworkPreview(artwork, images, { featured = false } = {}) {
  const preview = {
    id: artwork.id,
    title: artwork.title,
    medium: artwork.medium,
    width: artwork.width,
    height: artwork.height,
    depth: artwork.depth,
    dimensionUnit: artwork.dimensionUnit,
    pricePaise: artwork.pricePaise,
    currency: artwork.currency,
    status: artwork.status,
    inventoryQuantity: artwork.inventoryQuantity,
    reservedQuantity: artwork.reservedQuantity,
    availableQuantity: artwork.availableQuantity,
    isPurchasable: artwork.isPurchasable,
    images,
  };

  if (featured) {
    preview.story = artwork.story;
    preview.yearCreated = artwork.yearCreated;
  }

  return preview;
}

async function hydratePublicArtworkPreviews(artistId) {
  const rows = await db
    .select({
      id: artworks.id,
      title: artworks.title,
      story: artworks.story,
      medium: artworks.medium,
      yearCreated: artworks.yearCreated,
      width: artworks.width,
      height: artworks.height,
      depth: artworks.depth,
      dimensionUnit: artworks.dimensionUnit,
      pricePaise: artworks.pricePaise,
      currency: artworks.currency,
      inventoryQuantity: artworks.inventoryQuantity,
      status: artworks.status,
      createdAt: artworks.createdAt,
    })
    .from(artworks)
    .where(and(
      eq(artworks.artistId, artistId),
      inArray(artworks.status, PUBLIC_ARTWORK_STATUSES),
    ))
    .orderBy(desc(artworks.createdAt))
    .limit(ARTIST_PUBLIC_ARTWORK_LIMIT);

  if (rows.length === 0) {
    return [];
  }

  const artworkIds = rows.map((row) => row.id);
  const [reservedMap, imageRows] = await Promise.all([
    getActiveReservedQuantities(artworkIds),
    db.select().from(artworkImages).where(inArray(artworkImages.artworkId, artworkIds)),
  ]);

  return rows.map((row, index) => {
    const artwork = withAvailability(row, reservedMap.get(row.id) || 0);
    return toArtistArtworkPreview(
      artwork,
      sortArtworkImages(imageRows.filter((image) => image.artworkId === row.id)),
      { featured: index === 0 },
    );
  });
}

async function toAdminArtist(row) {
  return {
    ...row,
    artworks: await hydrateArtworks(row.id, { publicOnly: false }),
  };
}

async function toPublicArtist(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortBio: row.shortBio,
    biography: row.biography,
    profileImagePath: row.profileImagePath,
    profileImageAlt: row.profileImageAlt,
    artisticStyle: row.artisticStyle,
    medium: row.medium,
    location: row.location,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    publishedAt: row.publishedAt,
    artworks: await hydratePublicArtworkPreviews(row.id),
  };
}

export async function listPublicArtists(query = {}) {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;
  const whereClause = eq(artists.status, 'published');

  const [countRow] = await db
    .select({ count: sql`count(*)::int`.as('count') })
    .from(artists)
    .where(whereClause);

  const rows = await db
    .select()
    .from(artists)
    .where(whereClause)
    .orderBy(desc(artists.publishedAt), desc(artists.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((row) => mapListItem(row)),
    page,
    limit,
    total: Number(countRow?.count || 0),
  };
}

export async function getPublicArtistBySlug(slug) {
  const [row] = await db.select().from(artists).where(eq(artists.slug, slug)).limit(1);
  if (!row || row.status !== 'published') {
    throw new ApiError(404, 'Artist not found');
  }
  return toPublicArtist(row);
}

export async function listAdminArtists(query = {}) {
  const filters = [];
  if (query.status) {
    filters.push(eq(artists.status, query.status));
  }
  if (query.q) {
    const term = `%${query.q}%`;
    filters.push(or(ilike(artists.name, term), ilike(artists.slug, term)));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  const [countRow] = await db
    .select({ count: sql`count(*)::int`.as('count') })
    .from(artists)
    .where(whereClause);

  const rows = await db
    .select()
    .from(artists)
    .where(whereClause)
    .orderBy(desc(artists.updatedAt), desc(artists.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((row) => mapListItem(row, { includeAdminFields: true })),
    page,
    limit,
    total: Number(countRow?.count || 0),
  };
}

export async function getAdminArtistById(artistId) {
  const row = await getArtistRecord(artistId);
  return toAdminArtist(row);
}

export async function createArtist(payload, actorUserId) {
  const status = payload.status || 'draft';
  const values = {
    name: payload.name,
    slug: resolveSlug(payload.name, payload.slug),
    shortBio: payload.shortBio ?? null,
    biography: payload.biography ?? null,
    profileImagePath: payload.profileImagePath ?? null,
    profileImageAlt: payload.profileImageAlt ?? null,
    artisticStyle: payload.artisticStyle ?? null,
    medium: payload.medium ?? null,
    location: payload.location ?? null,
    seoTitle: payload.seoTitle ?? null,
    seoDescription: payload.seoDescription ?? null,
    status,
    publishedAt: nextPublishedAt(null, status),
  };

  if (values.profileImagePath) {
    throw new ApiError(400, 'Upload a portrait after the artist is created.');
  }

  if (status === 'published') {
    assertCanPublish(values);
  }

  let created;
  try {
    [created] = await db.insert(artists).values(values).returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'An artist with this slug already exists.');
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId,
    action: 'artist.create',
    entityType: 'artist',
    entityId: created.id,
    metadata: { status: created.status, slug: created.slug },
  });

  return toAdminArtist(created);
}

export async function updateArtist(artistId, payload, actorUserId) {
  const existing = await getArtistRecord(artistId);
  const updates = { ...payload };

  if (updates.slug) {
    updates.slug = slugify(updates.slug);
  }

  if (updates.profileImagePath) {
    assertPortraitStoragePathForArtist(artistId, updates.profileImagePath);
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
    [updated] = await db.update(artists).set(updates).where(eq(artists.id, artistId)).returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'An artist with this slug already exists.');
    }
    throw error;
  }

  if (updates.name && updates.name !== existing.name) {
    await db.update(artworks)
      .set({ artistName: updates.name })
      .where(eq(artworks.artistId, artistId));
  }

  await writeAuditLog({
    actorUserId,
    action: updates.status && updates.status !== existing.status
      ? (updates.status === 'published' ? 'artist.publish' : 'artist.unpublish')
      : 'artist.update',
    entityType: 'artist',
    entityId: artistId,
    metadata: {
      status: updated.status,
      slug: updated.slug,
      previousSlug: existing.slug,
    },
  });

  return toAdminArtist(updated);
}

export async function deleteArtist(artistId, actorUserId) {
  const existing = await getArtistRecord(artistId);
  await db.delete(artists).where(eq(artists.id, artistId));
  await writeAuditLog({
    actorUserId,
    action: 'artist.delete',
    entityType: 'artist',
    entityId: artistId,
    metadata: { slug: existing.slug, status: existing.status, name: existing.name },
  });
  return { id: artistId, deleted: true };
}

export default {
  listPublicArtists,
  getPublicArtistBySlug,
  listAdminArtists,
  getAdminArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
};
