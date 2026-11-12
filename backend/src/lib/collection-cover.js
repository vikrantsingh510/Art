import { ApiError } from '../utils/ApiError.js';

const COVER_PATH = /^collections\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/cover\.(jpe?g|png|webp|avif)$/i;

export function collectionCoverStoragePath(collectionId, fileName) {
  const ext = String(fileName || 'cover.jpg')
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
  return `collections/${collectionId}/cover.${mapped[ext] || 'jpg'}`;
}

export function assertCoverStoragePathForCollection(collectionId, storagePath) {
  const value = String(storagePath || '');
  const expectedPrefix = `collections/${collectionId}/`;
  if (!value.startsWith(expectedPrefix) || value.includes('..') || !COVER_PATH.test(value)) {
    throw new ApiError(400, 'Cover storage path must be collections/{collectionId}/cover.{ext} in artwork-images.');
  }
}

export default {
  collectionCoverStoragePath,
  assertCoverStoragePathForCollection,
};
