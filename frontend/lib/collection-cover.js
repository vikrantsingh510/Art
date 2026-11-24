import { publicStorageUrl } from './media.js';

const COVER_UNIQUE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXT_MAP = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
};

export function collectionCoverExtension(fileName) {
  const ext = String(fileName || 'cover.jpg')
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return EXT_MAP[ext] || 'jpg';
}

export function collectionCoverStoragePath(
  collectionId,
  fileName,
  uniqueId = globalThis.crypto.randomUUID(),
) {
  const ext = collectionCoverExtension(fileName);
  const id = COVER_UNIQUE_ID.test(uniqueId) ? String(uniqueId).toLowerCase() : globalThis.crypto.randomUUID();
  return `collections/${collectionId}/cover-${id}.${ext}`;
}

export function isCollectionCoverPath(collectionId, storagePath) {
  const value = String(storagePath || '');
  const prefix = `collections/${collectionId}/cover`;
  return value === prefix
    || value.startsWith(`${prefix}.`)
    || value.startsWith(`${prefix}-`);
}

export function collectionCoverCacheBust(updatedAt) {
  if (updatedAt == null || updatedAt === '') {
    return null;
  }
  const value = updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt).trim();
  return value || null;
}

export function collectionCoverUrl(storagePath, updatedAt, { publicUrl = publicStorageUrl } = {}) {
  const base = publicUrl(storagePath);
  if (!base) {
    return null;
  }
  const version = collectionCoverCacheBust(updatedAt);
  if (!version) {
    return base;
  }
  return `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}
