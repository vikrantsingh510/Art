import { getSupabaseUrl } from '../env.js';

export const AR_ASSETS_BUCKET = 'ar-assets';
export const AR_ASSETS_STAGING_BUCKET = 'ar-assets-staging';
export const CURRENT_JSON = 'current.json';
export const MANIFEST_JSON = 'manifest.json';
export const STAGING_JSON = 'staging.json';
export const GLB_FILE = 'painting.glb';
export const USDZ_FILE = 'painting.usdz';
export const STAGING_TTL_MS = 30 * 60 * 1000;
export const PUBLISH_LOCK_DIR = '_lock';
export const PUBLISH_LOCK_FILE = 'publish.json';
export const PUBLISH_LOCK_TTL_MS = 90 * 1000;

export const GLB_CONTENT_TYPE = 'model/gltf-binary';
export const USDZ_CONTENT_TYPE = 'model/vnd.usdz+zip';
export const JSON_CONTENT_TYPE = 'application/json';

export const VERSION_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const POINTER_CACHE_CONTROL = 'no-cache, max-age=0';

export function encodeObjectPath(objectPath) {
  return String(objectPath)
    .split('/')
    .filter((part) => part.length > 0)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function arAssetsPublicOrigin(supabaseUrl = getSupabaseUrl(), bucket = AR_ASSETS_BUCKET) {
  if (!supabaseUrl) {
    return null;
  }
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${bucket}`;
}

export function artworkStoragePrefix(artworkId) {
  return String(artworkId || '');
}

export function versionPrefix(artworkId, contentHash) {
  return `${artworkId}/${contentHash}`;
}

export function versionObjectPath(artworkId, contentHash, fileName) {
  return `${versionPrefix(artworkId, contentHash)}/${fileName}`;
}

export function currentPointerPath(artworkId) {
  return `${artworkId}/${CURRENT_JSON}`;
}

export function versionManifestPath(artworkId, contentHash) {
  return versionObjectPath(artworkId, contentHash, MANIFEST_JSON);
}

export function versionGlbPath(artworkId, contentHash) {
  return versionObjectPath(artworkId, contentHash, GLB_FILE);
}

export function versionUsdzPath(artworkId, contentHash) {
  return versionObjectPath(artworkId, contentHash, USDZ_FILE);
}

export function artworkStagingPrefix(artworkId) {
  return String(artworkId || '');
}

export function stagingPrefix(artworkId, contentHash, attemptId) {
  return `${artworkId}/${contentHash}/${attemptId}`;
}

export function stagingObjectPath(artworkId, contentHash, attemptId, fileName) {
  return `${stagingPrefix(artworkId, contentHash, attemptId)}/${fileName}`;
}

export function stagingGlbPath(artworkId, contentHash, attemptId) {
  return stagingObjectPath(artworkId, contentHash, attemptId, GLB_FILE);
}

export function stagingUsdzPath(artworkId, contentHash, attemptId) {
  return stagingObjectPath(artworkId, contentHash, attemptId, USDZ_FILE);
}

export function stagingManifestPath(artworkId, contentHash, attemptId) {
  return stagingObjectPath(artworkId, contentHash, attemptId, MANIFEST_JSON);
}

export function stagingMetaPath(artworkId, contentHash, attemptId) {
  return stagingObjectPath(artworkId, contentHash, attemptId, STAGING_JSON);
}

export function publishLockPrefix(artworkId) {
  return `${artworkId}/${PUBLISH_LOCK_DIR}`;
}

export function publishLockPath(artworkId) {
  return `${publishLockPrefix(artworkId)}/${PUBLISH_LOCK_FILE}`;
}

export function publishLockEpochPath(artworkId, epoch) {
  return `${publishLockPrefix(artworkId)}/${epoch}.json`;
}

export function contentTypeForFileName(fileName) {
  if (fileName.endsWith('.glb')) {
    return GLB_CONTENT_TYPE;
  }
  if (fileName.endsWith('.usdz')) {
    return USDZ_CONTENT_TYPE;
  }
  if (fileName.endsWith('.json')) {
    return JSON_CONTENT_TYPE;
  }
  return 'application/octet-stream';
}

export function publicObjectUrl(origin, objectPath) {
  if (!origin || !objectPath) {
    return null;
  }
  return `${String(origin).replace(/\/$/, '')}/${String(objectPath).replace(/^\/+/, '')}`;
}
