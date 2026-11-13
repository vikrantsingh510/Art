export const ARTWORK_IMAGE_BUCKET = 'artwork-images';
export const ARTWORK_PREVIEW_BUCKET = 'artwork-previews';
export const ARTWORK_MEDIA_BUCKETS = new Set(['artwork-videos', 'artwork-documents']);
export const AR_ASSET_BUCKETS = ['ar-assets', 'ar-assets-staging'];

export const ARTWORK_DELETE_BLOCKED_MESSAGE = 'This artwork cannot be permanently deleted because it has order or reservation history. Archive it instead.';

export function cleanStoragePath(storagePath) {
  return String(storagePath || '').replace(/^\/+/, '');
}

export function isUnsafeStoragePath(storagePath) {
  const raw = String(storagePath || '');
  const clean = cleanStoragePath(raw);
  return !clean
    || raw.includes('\\')
    || clean.includes('..')
    || /^[a-z][a-z0-9+.-]*:/i.test(raw);
}

export function isArtworkOwnedPath(artworkId, storagePath) {
  if (!artworkId || isUnsafeStoragePath(storagePath)) {
    return false;
  }
  const prefix = `${artworkId}/`;
  const clean = cleanStoragePath(storagePath);
  return clean.startsWith(prefix) && clean.length > prefix.length;
}

export function displayDerivativePath(storagePath) {
  const clean = cleanStoragePath(storagePath);
  if (!clean || isUnsafeStoragePath(storagePath) || clean.toLowerCase().endsWith('.display.webp')) {
    return null;
  }
  return `${clean}.display.webp`;
}

export function ownedImagePaths(artworkId, images = []) {
  const paths = [];
  for (const image of images) {
    const original = cleanStoragePath(image?.storagePath);
    if (!isArtworkOwnedPath(artworkId, original)) {
      continue;
    }
    paths.push({ bucket: ARTWORK_IMAGE_BUCKET, path: original });
    const derivative = displayDerivativePath(original);
    if (derivative && isArtworkOwnedPath(artworkId, derivative)) {
      paths.push({ bucket: ARTWORK_IMAGE_BUCKET, path: derivative });
    }
  }
  return paths;
}

export function ownedMediaPaths(artworkId, media = []) {
  const paths = [];
  for (const item of media) {
    const bucket = String(item?.storageBucket || '');
    const objectPath = cleanStoragePath(item?.storagePath);
    if (!ARTWORK_MEDIA_BUCKETS.has(bucket) || !isArtworkOwnedPath(artworkId, objectPath)) {
      continue;
    }
    paths.push({ bucket, path: objectPath });
  }
  return paths;
}

export function ownedPreviewPaths(artworkId, previews = []) {
  const paths = [];
  for (const preview of previews) {
    const objectPath = cleanStoragePath(preview?.storagePath);
    if (!isArtworkOwnedPath(artworkId, objectPath)) {
      continue;
    }
    paths.push({ bucket: ARTWORK_PREVIEW_BUCKET, path: objectPath });
  }
  return paths;
}

export default {
  ARTWORK_IMAGE_BUCKET,
  ARTWORK_PREVIEW_BUCKET,
  ARTWORK_MEDIA_BUCKETS,
  AR_ASSET_BUCKETS,
  ARTWORK_DELETE_BLOCKED_MESSAGE,
  cleanStoragePath,
  isUnsafeStoragePath,
  isArtworkOwnedPath,
  displayDerivativePath,
  ownedImagePaths,
  ownedMediaPaths,
  ownedPreviewPaths,
};
