import { validateArtworkImageFile } from './artwork-image-constraints.js';
import { deleteArtworkImageFile, uploadArtworkImageFile } from './artwork-image-upload.js';
import { publicStorageUrl } from './media.js';

export const HOMEPAGE_HERO_ALT_MAX_LENGTH = 160;
export const HOMEPAGE_HERO_FALLBACK_IMAGE = '/images/hero-salon.webp';
export const HOMEPAGE_HERO_DEFAULT_ALT = 'Museum gallery exhibition of large-scale original textured paintings';
export const HOMEPAGE_HERO_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png'];
export const HOMEPAGE_HERO_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
export const HOMEPAGE_HERO_KINDS = ['jpeg', 'png', 'webp'];

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

export function heroExtensionFromFileName(fileName) {
  const ext = String(fileName || '')
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return EXT_MAP[ext] || null;
}

export function homepageHeroStoragePath(fileName, uniqueId = globalThis.crypto.randomUUID()) {
  const ext = heroExtensionFromFileName(fileName) || 'webp';
  const id = HERO_UNIQUE_ID.test(uniqueId) ? String(uniqueId).toLowerCase() : globalThis.crypto.randomUUID();
  return `settings/homepage/hero-${id}.${ext}`;
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

export function homepageHeroCacheBust(updatedAt) {
  if (updatedAt == null || updatedAt === '') {
    return null;
  }
  const value = updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt).trim();
  return value || null;
}

export function resolveHomepageHero(snapshot, { publicUrl = publicStorageUrl } = {}) {
  const alt = readHomepageHeroAltText(snapshot?.altText) || HOMEPAGE_HERO_DEFAULT_ALT;
  const fallback = {
    src: HOMEPAGE_HERO_FALLBACK_IMAGE,
    alt,
    unoptimized: false,
  };

  if (!isHomepageHeroStoragePath(snapshot?.storagePath)) {
    return fallback;
  }

  const base = publicUrl(snapshot.storagePath);
  if (!base || !/^https?:\/\//i.test(base)) {
    return fallback;
  }

  const version = homepageHeroCacheBust(snapshot.updatedAt);
  return {
    src: version ? `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}` : base,
    alt,
    unoptimized: true,
  };
}

export function homepageHeroAcceptAttribute(constraints) {
  const types = Array.isArray(constraints?.allowedMimeTypes)
    ? constraints.allowedMimeTypes.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const allowed = types.length
    ? HOMEPAGE_HERO_MIME_TYPES.filter((type) => types.includes(type))
    : HOMEPAGE_HERO_MIME_TYPES;
  return (allowed.length ? allowed : HOMEPAGE_HERO_MIME_TYPES).join(',');
}

export function normalizeHomepageHeroAltText(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) {
    return null;
  }
  if (/[<>]/.test(trimmed)) {
    throw new Error('Hero alt text cannot contain HTML.');
  }
  if (trimmed.length > HOMEPAGE_HERO_ALT_MAX_LENGTH) {
    throw new Error(`Hero alt text must be at most ${HOMEPAGE_HERO_ALT_MAX_LENGTH} characters.`);
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

export function validateHomepageHeroFile(file, constraints, inspection = null) {
  const result = validateArtworkImageFile(file, constraints, inspection);
  if (!result.ok) {
    return result;
  }

  const ext = heroExtensionFromFileName(file?.name);
  if (!ext) {
    return {
      ok: false,
      code: 'extension',
      message: 'Hero image must be WebP, JPEG or PNG.',
      warnings: result.warnings || [],
    };
  }

  const kind = String(inspection?.kind || '').toLowerCase();
  if (kind && kind !== 'unknown' && !HOMEPAGE_HERO_KINDS.includes(kind)) {
    return {
      ok: false,
      code: 'kind',
      message: 'Hero image must be WebP, JPEG or PNG.',
      warnings: result.warnings || [],
    };
  }

  return result;
}

export function explainHomepageHeroUploadError(error) {
  const message = error?.message || String(error || 'Upload failed');
  if (
    error?.code === 'HERO_SETTINGS_AFTER_UPLOAD_FAILED'
    || error?.code === 'HERO_SETTINGS_CLEANUP_FAILED'
  ) {
    return message;
  }
  return `The hero image could not be uploaded: ${message}. The current homepage banner was not changed.`;
}

export function classifyHomepageHeroSettingsError({
  settingsError,
  cleanupError = null,
  storagePath,
} = {}) {
  const settingsMessage = settingsError?.message || String(settingsError || 'Hero settings could not be saved.');
  const pathLabel = storagePath || 'unknown path';

  if (cleanupError) {
    const failure = new Error(
      `Hero settings could not be saved and the newly uploaded image could not be cleaned up. The previous hero was kept. Path ${pathLabel}. ${settingsMessage}. Cleanup: ${cleanupError.message || cleanupError}`,
    );
    failure.code = 'HERO_SETTINGS_CLEANUP_FAILED';
    failure.cause = settingsError;
    failure.cleanupError = cleanupError;
    failure.storagePath = storagePath;
    return failure;
  }

  const failure = new Error(
    `Hero settings could not be saved. The newly uploaded image was removed. The previous hero was kept. ${settingsMessage}`,
  );
  failure.code = 'HERO_SETTINGS_AFTER_UPLOAD_FAILED';
  failure.cause = settingsError;
  failure.storagePath = storagePath;
  return failure;
}

export async function persistHomepageHero({
  pendingFile = null,
  currentStoragePath = null,
  altText = null,
  uploadFile = uploadArtworkImageFile,
  deleteStorage = deleteArtworkImageFile,
  updateSettings,
  storageSession,
  createPath = homepageHeroStoragePath,
} = {}) {
  if (typeof updateSettings !== 'function') {
    throw new Error('A settings update function is required to publish the hero image.');
  }

  const nextAltText = normalizeHomepageHeroAltText(altText);

  if (!pendingFile) {
    return updateSettings({
      storagePath: currentStoragePath || null,
      altText: nextAltText,
    });
  }

  const nextPath = createPath(pendingFile.name);
  if (!isHomepageHeroStoragePath(nextPath)) {
    throw new Error('Hero storage path must be settings/homepage/hero-{id}.{webp|jpg|jpeg|png}.');
  }

  try {
    await uploadFile({
      ...storageSession,
      path: nextPath,
      file: pendingFile,
    });
  } catch (uploadError) {
    try {
      await deleteStorage({ ...storageSession, path: nextPath });
    } catch {
      // Incomplete upload leftover cleanup is best-effort. The published hero is unchanged.
    }
    throw uploadError;
  }

  let saved;
  try {
    saved = await updateSettings({
      storagePath: nextPath,
      altText: nextAltText,
    });
  } catch (settingsError) {
    let cleanupError = null;
    try {
      await deleteStorage({ ...storageSession, path: nextPath });
    } catch (error) {
      cleanupError = error;
    }
    throw classifyHomepageHeroSettingsError({
      settingsError,
      cleanupError,
      storagePath: nextPath,
    });
  }

  if (currentStoragePath && currentStoragePath !== nextPath) {
    try {
      await deleteStorage({ ...storageSession, path: currentStoragePath });
    } catch {
      // The new hero is already published. Old-object cleanup is best-effort.
    }
  }

  return saved;
}

export async function restoreHomepageHeroDefault({
  currentStoragePath = null,
  altText = null,
  deleteStorage = deleteArtworkImageFile,
  updateSettings,
  storageSession,
} = {}) {
  if (typeof updateSettings !== 'function') {
    throw new Error('A settings update function is required to restore the default hero.');
  }

  const saved = await updateSettings({
    storagePath: null,
    altText: normalizeHomepageHeroAltText(altText),
  });

  if (currentStoragePath) {
    try {
      await deleteStorage({ ...storageSession, path: currentStoragePath });
    } catch {
      // Default hero is already published. Old-object cleanup is best-effort.
    }
  }

  return saved;
}
