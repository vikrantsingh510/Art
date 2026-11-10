import { client } from '../config/database.js';
import { ApiError } from '../utils/ApiError.js';

export const ARTWORK_IMAGES_BUCKET = 'artwork-images';

let loadArtworkImagesBucket = defaultLoadArtworkImagesBucket;

export function setStorageConstraintsDependencies(overrides = {}) {
  if (overrides.loadArtworkImagesBucket) {
    loadArtworkImagesBucket = overrides.loadArtworkImagesBucket;
  }
}

export function resetStorageConstraintsDependencies() {
  loadArtworkImagesBucket = defaultLoadArtworkImagesBucket;
}

async function defaultLoadArtworkImagesBucket() {
  const [row] = await client`
    SELECT
      id,
      file_size_limit,
      allowed_mime_types
    FROM storage.buckets
    WHERE id = ${ARTWORK_IMAGES_BUCKET}
    LIMIT 1
  `;
  return row || null;
}

function toByteLimit(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return null;
  }
  return bytes;
}

function toMimeList(value) {
  if (value == null) {
    return null;
  }
  const list = Array.isArray(value) ? value : [value];
  const cleaned = list.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : null;
}

export async function getArtworkImagesUploadConstraints() {
  let row;
  try {
    row = await loadArtworkImagesBucket();
  } catch {
    throw new ApiError(503, 'Artwork-images bucket constraints are unavailable.');
  }

  if (!row) {
    throw new ApiError(404, 'Artwork-images bucket was not found.');
  }

  return {
    bucket: ARTWORK_IMAGES_BUCKET,
    fileSizeLimitBytes: toByteLimit(row.file_size_limit),
    allowedMimeTypes: toMimeList(row.allowed_mime_types),
  };
}

export default {
  ARTWORK_IMAGES_BUCKET,
  getArtworkImagesUploadConstraints,
  setStorageConstraintsDependencies,
  resetStorageConstraintsDependencies,
};
