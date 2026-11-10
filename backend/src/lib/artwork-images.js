import { ApiError } from '../utils/ApiError.js';

export const MAX_ARTWORK_IMAGES = 5;

export function assertImageCapacity(existingCount, incomingCount = 1) {
  const existing = Number(existingCount) || 0;
  const incoming = Number(incomingCount) || 0;
  if (existing + incoming > MAX_ARTWORK_IMAGES) {
    throw new ApiError(
      400,
      `An artwork may have at most ${MAX_ARTWORK_IMAGES} catalogue images.`,
    );
  }
}

export function nextDisplayOrder(images) {
  if (!Array.isArray(images) || images.length === 0) {
    return 0;
  }
  return Math.max(...images.map((image) => Number(image.displayOrder) || 0)) + 1;
}

export function sortArtworkImages(images) {
  return [...(images || [])].sort((left, right) => {
    const order = (Number(left.displayOrder) || 0) - (Number(right.displayOrder) || 0);
    if (order !== 0) {
      return order;
    }
    return String(left.id || '').localeCompare(String(right.id || ''));
  });
}

export function replacementPrimaryId(images, removedId) {
  const remaining = sortArtworkImages(images).filter((image) => image.id !== removedId);
  const currentPrimary = remaining.find((image) => image.isPrimary);
  return currentPrimary?.id || remaining[0]?.id || null;
}

export function assertCanPublish(status, imageCount) {
  if (status === 'published' && Number(imageCount) < 1) {
    throw new ApiError(400, 'An artwork must have at least one catalogue image before it can be published.');
  }
}

export function assertStoragePathForArtwork(artworkId, storagePath) {
  const prefix = `${artworkId}/`;
  if (!String(storagePath || '').startsWith(prefix)) {
    throw new ApiError(400, 'Image storage path must be stored under this artwork’s identifier.');
  }
}

export function assertReorderPayload(existingIds, requestedIds) {
  if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
    throw new ApiError(400, 'Image order must include every catalogue image exactly once.');
  }

  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new ApiError(400, 'Image order cannot contain duplicate image ids.');
  }

  const existing = [...existingIds].map(String).sort();
  const requested = requestedIds.map(String);
  if (requested.length !== existing.length) {
    throw new ApiError(400, 'Image order must include every catalogue image exactly once.');
  }

  const requestedSorted = [...requested].sort();
  for (let index = 0; index < existing.length; index += 1) {
    if (existing[index] !== requestedSorted[index]) {
      throw new ApiError(400, 'Image order includes an image that does not belong to this artwork.');
    }
  }
}

export function assertPrimaryBelongsToArtwork(imageIds, primaryImageId) {
  if (!primaryImageId) {
    return;
  }
  if (!imageIds.map(String).includes(String(primaryImageId))) {
    throw new ApiError(400, 'The primary image must belong to this artwork.');
  }
}

export function assertImageFileAgainstConstraints(payload = {}, constraints) {
  if (!constraints) {
    throw new ApiError(503, 'Artwork-images bucket constraints are unavailable.');
  }

  const allowed = Array.isArray(constraints.allowedMimeTypes)
    ? constraints.allowedMimeTypes.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
    : [];

  if (allowed.length > 0) {
    const mime = String(payload.mimeType || '').trim().toLowerCase();
    if (!mime) {
      throw new ApiError(400, 'A MIME type is required when the artwork-images bucket publishes an allow-list.');
    }
    if (!allowed.includes(mime)) {
      throw new ApiError(
        400,
        `This file type is not allowed. The artwork-images bucket accepts: ${allowed.join(', ')}.`,
      );
    }
  }

  const limit = constraints.fileSizeLimitBytes;
  if (Number.isFinite(Number(limit)) && Number(limit) >= 0) {
    if (payload.fileSizeBytes === undefined || payload.fileSizeBytes === null || payload.fileSizeBytes === '') {
      throw new ApiError(400, 'A file size is required when the artwork-images bucket publishes a size limit.');
    }
    if (Number(payload.fileSizeBytes) > Number(limit)) {
      throw new ApiError(400, 'This file exceeds the artwork-images bucket size limit.');
    }
  }
}

export default {
  MAX_ARTWORK_IMAGES,
  assertImageCapacity,
  nextDisplayOrder,
  sortArtworkImages,
  replacementPrimaryId,
  assertCanPublish,
  assertStoragePathForArtwork,
  assertReorderPayload,
  assertPrimaryBelongsToArtwork,
  assertImageFileAgainstConstraints,
};
