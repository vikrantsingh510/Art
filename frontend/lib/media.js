import { getSupabaseUrl } from './env.js';

export const PUBLIC_IMAGE_BUCKET = 'artwork-images';

export function publicStorageUrl(storagePath, bucket = PUBLIC_IMAGE_BUCKET) {
  if (!storagePath) {
    return null;
  }

  if (/^https?:\/\//i.test(storagePath)) {
    return storagePath;
  }

  const base = getSupabaseUrl();
  if (!base) {
    return null;
  }

  const cleanPath = String(storagePath).replace(/^\/+/, '');
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

export function primaryArtworkImage(artwork) {
  const images = Array.isArray(artwork?.images) ? [...artwork.images] : [];
  images.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
  return images.find((image) => image.isPrimary) || images[0] || null;
}

export function artworkImageUrl(artwork, image) {
  const chosen = image || primaryArtworkImage(artwork);
  return publicStorageUrl(chosen?.storagePath);
}

export function isSafeArtworkDisplayPath(storagePath) {
  const clean = String(storagePath || '').replace(/^\/+/, '');
  if (!clean || clean.includes('..') || clean.includes('\\')) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/.+/i.test(clean);
}

export function isArtworkDisplayDerivativePath(storagePath) {
  return String(storagePath || '').toLowerCase().endsWith('.display.webp');
}

export function displayDerivativeStoragePath(storagePath) {
  const clean = String(storagePath || '').replace(/^\/+/, '');
  if (!clean || clean.includes('..') || isArtworkDisplayDerivativePath(clean)) {
    return null;
  }
  return `${clean}.display.webp`;
}

export function artworkDisplayPath(storagePath) {
  const clean = String(storagePath || '').replace(/^\/+/, '');
  if (!isSafeArtworkDisplayPath(clean) || isArtworkDisplayDerivativePath(clean)) {
    return null;
  }
  return `/media/display/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

export function artworkStorefrontImageUrl(artwork, image) {
  const chosen = image || primaryArtworkImage(artwork);
  const storagePath = chosen?.storagePath;
  if (!storagePath) {
    return null;
  }
  if (/^https?:\/\//i.test(storagePath)) {
    return storagePath;
  }
  return artworkDisplayPath(storagePath) || publicStorageUrl(storagePath);
}

export function publicMediaItems(artwork) {
  return (artwork?.media || []).filter((item) => item.accessLevel === 'public');
}

export function privateMediaItems(artwork) {
  return (artwork?.media || []).filter((item) => item.accessLevel === 'private');
}
