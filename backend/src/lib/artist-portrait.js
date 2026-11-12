import { ApiError } from '../utils/ApiError.js';

const PORTRAIT_PATH = /^artists\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/portrait\.(jpe?g|png|webp|avif)$/i;

export function artistPortraitStoragePath(artistId, fileName) {
  const ext = String(fileName || 'portrait.jpg')
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const mapped = {
    jpg: 'jpg',
    jpeg: 'jpg',
    png: 'png',
    webp: 'webp',
    avif: 'avif',
  };
  return `artists/${artistId}/portrait.${mapped[ext] || 'jpg'}`;
}

export function assertPortraitStoragePathForArtist(artistId, storagePath) {
  const value = String(storagePath || '');
  const expectedPrefix = `artists/${artistId}/`;
  if (!value.startsWith(expectedPrefix) || value.includes('..') || !PORTRAIT_PATH.test(value)) {
    throw new ApiError(400, 'Portrait storage path must be artists/{artistId}/portrait.{ext} in artwork-images.');
  }
}

export default {
  artistPortraitStoragePath,
  assertPortraitStoragePathForArtist,
};
