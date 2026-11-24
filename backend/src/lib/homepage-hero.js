import { randomUUID } from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';

export const HOMEPAGE_HERO_ALT_MAX_LENGTH = 160;
export const HOMEPAGE_HERO_STORAGE_PREFIX = 'settings/homepage/';

const HERO_UNIQUE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOMEPAGE_HERO_PATH =
  /^settings\/homepage\/hero-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$/i;
const EXT_MAP = {
  jpg: 'jpg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
};

export function homepageHeroStoragePath(fileName, uniqueId = randomUUID()) {
  const ext = String(fileName || 'hero.webp')
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const id = HERO_UNIQUE_ID.test(uniqueId) ? String(uniqueId).toLowerCase() : randomUUID();
  return `settings/homepage/hero-${id}.${EXT_MAP[ext] || 'webp'}`;
}

export function isHomepageHeroStoragePath(storagePath) {
  const value = String(storagePath || '');
  if (
    !value
    || value.includes('..')
    || value.includes('\\')
    || value.includes('\0')
    || /:\/\//.test(value)
    || value.startsWith('/')
  ) {
    return false;
  }
  return HOMEPAGE_HERO_PATH.test(value);
}

export function assertHomepageHeroStoragePath(storagePath) {
  if (!isHomepageHeroStoragePath(storagePath)) {
    throw new ApiError(
      400,
      'Hero storage path must be settings/homepage/hero-{id}.{webp|jpg|jpeg|png} in artwork-images.',
    );
  }
}

export function normalizeHomepageHeroStoragePath(storagePath) {
  if (storagePath == null) {
    return null;
  }

  const trimmed = String(storagePath).trim();
  if (!trimmed) {
    return null;
  }

  assertHomepageHeroStoragePath(trimmed);
  return trimmed.toLowerCase();
}

export function normalizeHomepageHeroAltText(input) {
  if (input == null) {
    return null;
  }

  const trimmed = String(input).trim();
  if (!trimmed) {
    return null;
  }

  if (/[<>]/.test(trimmed)) {
    throw new ApiError(400, 'Hero alt text cannot contain HTML.');
  }

  if (trimmed.length > HOMEPAGE_HERO_ALT_MAX_LENGTH) {
    throw new ApiError(400, `Hero alt text must be at most ${HOMEPAGE_HERO_ALT_MAX_LENGTH} characters.`);
  }

  return trimmed;
}

export function readHomepageHeroAltText(input) {
  if (input == null) {
    return null;
  }

  const trimmed = String(input).trim();
  if (!trimmed || /[<>]/.test(trimmed)) {
    return null;
  }

  return trimmed.slice(0, HOMEPAGE_HERO_ALT_MAX_LENGTH);
}

export function toHomepageHeroSnapshot(row) {
  if (!row) {
    return {
      storagePath: null,
      altText: null,
      updatedAt: null,
    };
  }

  const value = row.value && typeof row.value === 'object' ? row.value : {};
  return {
    storagePath: isHomepageHeroStoragePath(value.storagePath) ? String(value.storagePath).toLowerCase() : null,
    altText: readHomepageHeroAltText(value.altText),
    updatedAt: row.updatedAt || null,
  };
}

export default {
  HOMEPAGE_HERO_ALT_MAX_LENGTH,
  HOMEPAGE_HERO_STORAGE_PREFIX,
  homepageHeroStoragePath,
  isHomepageHeroStoragePath,
  assertHomepageHeroStoragePath,
  normalizeHomepageHeroStoragePath,
  normalizeHomepageHeroAltText,
  readHomepageHeroAltText,
  toHomepageHeroSnapshot,
};
