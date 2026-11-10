import { MAX_ARTWORK_IMAGES, sortArtworkImages } from './artwork-image-queue.js';

export function orderedGalleryImages(artwork) {
  return sortArtworkImages(artwork?.images).slice(0, MAX_ARTWORK_IMAGES);
}

export function wrapGalleryIndex(index, length) {
  const size = Number(length) || 0;
  if (size <= 0) {
    return 0;
  }
  return ((Number(index) % size) + size) % size;
}

export function galleryHasControls(images) {
  return (images || []).length > 1;
}

export function swipeDirection(deltaX, threshold = 40) {
  if (!Number.isFinite(Number(deltaX))) {
    return null;
  }
  if (deltaX <= -threshold) {
    return 'next';
  }
  if (deltaX >= threshold) {
    return 'previous';
  }
  return null;
}
