import { getSupabaseUrl } from './env';

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

export function publicMediaItems(artwork) {
  return (artwork?.media || []).filter((item) => item.accessLevel === 'public');
}

export function privateMediaItems(artwork) {
  return (artwork?.media || []).filter((item) => item.accessLevel === 'private');
}
