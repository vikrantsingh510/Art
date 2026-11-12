import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { artists } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';

export async function getArtistRow(artistId) {
  const [row] = await db.select().from(artists).where(eq(artists.id, artistId)).limit(1);
  return row || null;
}

export async function resolveArtworkArtistAssociation(payload, { existingArtistId = null } = {}) {
  if (!Object.prototype.hasOwnProperty.call(payload, 'artistId')) {
    return {
      artistId: existingArtistId,
      artistName: payload.artistName,
    };
  }

  if (payload.artistId === null || payload.artistId === '') {
    return {
      artistId: null,
      artistName: payload.artistName,
    };
  }

  const artist = await getArtistRow(payload.artistId);
  if (!artist) {
    throw new ApiError(400, 'Artist not found.');
  }
  const keepingExisting = existingArtistId && existingArtistId === artist.id;
  if (artist.status !== 'published' && !keepingExisting) {
    throw new ApiError(400, 'Only published artists can be associated with an artwork.');
  }

  return {
    artistId: artist.id,
    artistName: artist.name,
  };
}

export function mapArtistSummary(row, { publicOnly = true } = {}) {
  if (!row) {
    return null;
  }
  if (publicOnly && row.status !== 'published') {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: publicOnly ? undefined : row.status,
  };
}

export default {
  getArtistRow,
  resolveArtworkArtistAssociation,
  mapArtistSummary,
};
