import { ApiError } from '../utils/ApiError.js';

const COVER_UNIQUE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COVER_PATH = /^collections\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/cover(?:-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?\.(jpe?g|png|webp|avif)$/i;

const EXT_MAP = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
};

export function collectionCoverStoragePath(
  collectionId,
  fileName,
  uniqueId = globalThis.crypto.randomUUID(),
) {
  const ext = String(fileName || 'cover.jpg')
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const mapped = EXT_MAP[ext] || 'jpg';
  const id = COVER_UNIQUE_ID.test(uniqueId) ? String(uniqueId).toLowerCase() : globalThis.crypto.randomUUID();
  return `collections/${collectionId}/cover-${id}.${mapped}`;
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
