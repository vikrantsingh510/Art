import { getSupabaseUrl } from '../env.js';
import { sha256Hex } from './hash.js';
import { catalogueIntegrityReasons, pointerIsComplete, verifyAssetBuffers } from './integrity.js';
import {
  arAssetsPublicOrigin,
  currentPointerPath,
  publicObjectUrl,
  versionGlbPath,
  versionManifestPath,
  versionUsdzPath,
} from './storage-paths.js';
import { evaluateStorefrontAr, serializeStorefrontAr } from './storefront.js';

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const GALLERY_IMAGE_BUCKET = 'artwork-images';

/**
 * current.json stores version-relative paths (`{hash}/manifest.json`).
 * Public Storage objects live under `{artworkId}/{hash}/…`.
 */
function prefixedObjectPath(artworkId, relativePath) {
  if (!artworkId || relativePath == null || relativePath === '') {
    return null;
  }
  const cleaned = String(relativePath).replace(/^\/+/, '');
  return cleaned.startsWith(`${artworkId}/`) ? cleaned : `${artworkId}/${cleaned}`;
}

function catalogueImageUrl(artwork) {
  const images = Array.isArray(artwork?.images) ? [...artwork.images] : [];
  images.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
  const chosen = images.find((image) => image.isPrimary) || images[0] || null;
  const storagePath = chosen?.storagePath;
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
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${GALLERY_IMAGE_BUCKET}/${String(storagePath).replace(/^\/+/, '')}`;
}

function emptyResult(artwork, extraReasons = []) {
  const evaluation = evaluateStorefrontAr({
    artwork: artwork || {},
    current: null,
    manifest: null,
    assetsPresent: false,
    imageAvailable: false,
  });
  if (extraReasons.length > 0) {
    evaluation.reasons = [...new Set([...evaluation.reasons, ...extraReasons])];
    evaluation.ready = false;
  }
  return serializeStorefrontAr(evaluation, { artworkId: artwork?.id });
}

async function readJsonFromUrl(url, fetchImpl) {
  if (!url) {
    return null;
  }
  try {
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

async function readBufferFromUrl(url, fetchImpl, { maxBytes = MAX_SOURCE_BYTES } = {}) {
  if (!url) {
    return null;
  }
  try {
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > maxBytes) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      return null;
    }
    return buffer;
  } catch {
    return null;
  }
}

async function readJsonFromStorage(storage, objectPath) {
  try {
    const buffer = await storage.download(objectPath);
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Hosting-independent storefront resolver. Reads the current pointer and
 * version manifest from Supabase Storage (or an injected adapter). Never
 * uses process.cwd() or public/ar-assets.
 */
export async function resolveArtworkArAssets(artwork, {
  storage = null,
  fetchImpl = globalThis.fetch,
  origin = storage?.publicOrigin || arAssetsPublicOrigin(),
  sourceImageBuffer = null,
  verifyRemoteAssets = true,
} = {}) {
  try {
    return await resolveArtworkArAssetsUnsafe(artwork, {
      storage,
      fetchImpl,
      origin,
      sourceImageBuffer,
      verifyRemoteAssets,
    });
  } catch {
    return emptyResult(artwork, ['ar-resolve-failed']);
  }
}

async function resolveArtworkArAssetsUnsafe(artwork, {
  storage,
  fetchImpl,
  origin,
  sourceImageBuffer,
  verifyRemoteAssets,
}) {
  const artworkId = artwork?.id;
  if (!artworkId) {
    return emptyResult(artwork);
  }
  if (!storage && !origin) {
    return emptyResult(artwork, ['missing-storage-origin']);
  }

  const current = storage
    ? await readJsonFromStorage(storage, currentPointerPath(artworkId))
    : await readJsonFromUrl(publicObjectUrl(origin, currentPointerPath(artworkId)), fetchImpl);

  const versionDir = current?.versionDir || current?.contentHash || null;
  const manifestPath = current?.files?.manifest
    ? prefixedObjectPath(artworkId, current.files.manifest)
    : (versionDir ? versionManifestPath(artworkId, versionDir) : null);
  const manifest = storage && manifestPath
    ? await readJsonFromStorage(storage, manifestPath)
    : await readJsonFromUrl(publicObjectUrl(origin, manifestPath), fetchImpl);

  let sourceBuffer = sourceImageBuffer;
  const hasCatalogueImage = Boolean(catalogueImageUrl(artwork) || artwork?.images?.length);
  if (!sourceBuffer && current && hasCatalogueImage) {
    const imageUrl = catalogueImageUrl(artwork);
    if (imageUrl) {
      sourceBuffer = await readBufferFromUrl(imageUrl, fetchImpl);
    }
  }

  const integrityReasons = catalogueIntegrityReasons(artwork, manifest, {
    sourceImageBuffer: sourceBuffer,
    sourceImageRequired: Boolean(current && hasCatalogueImage),
  });

  let glb = null;
  let usdz = null;
  const contentHash = manifest?.contentHash || current?.contentHash || versionDir;
  const glbRel = manifest?.files?.glb || current?.files?.glb || null;
  const usdzRel = manifest?.files?.usdz || current?.files?.usdz || null;
  const glbPath = glbRel
    ? prefixedObjectPath(artworkId, glbRel)
    : (contentHash ? versionGlbPath(artworkId, contentHash) : null);
  const usdzPath = usdzRel
    ? prefixedObjectPath(artworkId, usdzRel)
    : (contentHash ? versionUsdzPath(artworkId, contentHash) : null);
  if (verifyRemoteAssets && glbPath && usdzPath) {
    if (storage) {
      try {
        glb = await storage.download(glbPath);
        usdz = await storage.download(usdzPath);
      } catch {
        glb = null;
        usdz = null;
      }
    } else {
      glb = await readBufferFromUrl(publicObjectUrl(origin, glbPath), fetchImpl);
      usdz = await readBufferFromUrl(publicObjectUrl(origin, usdzPath), fetchImpl);
    }
  }

  const remoteVerified = verifyRemoteAssets
    ? verifyAssetBuffers({
      glb,
      usdz,
      manifest,
      physical: manifest,
    })
    : { ok: Boolean(current?.files?.glb && current?.files?.usdz) };

  if (current && !pointerIsComplete(current)) {
    integrityReasons.push('stale-pointer');
  }
  if (manifest?.contentHash && current?.contentHash && manifest.contentHash !== current.contentHash) {
    integrityReasons.push('stale-hash');
  }
  if (sourceBuffer && manifest?.sourceImageSha256 && sha256Hex(sourceBuffer) !== manifest.sourceImageSha256) {
    integrityReasons.push('stale-source-image');
  }
  if (verifyRemoteAssets && !remoteVerified.ok) {
    integrityReasons.push(remoteVerified.reason || 'invalid-assets');
  }

  const assetsPresent = remoteVerified.ok === true;
  const imageAvailable = Boolean(sourceBuffer?.length) || Boolean(artwork?.images?.length);
  const evaluation = evaluateStorefrontAr({
    artwork,
    current,
    manifest,
    assetsPresent,
    imageAvailable,
    sourceImageSha256: sourceBuffer?.length ? sha256Hex(sourceBuffer) : null,
  });
  evaluation.reasons = [...new Set([...evaluation.reasons, ...integrityReasons])];
  evaluation.ready = evaluation.reasons.length === 0;

  const pointerForUrls = current
    ? {
      ...current,
      files: {
        ...current.files,
        glb: glbRel || current.files?.glb,
        usdz: usdzRel || current.files?.usdz,
      },
    }
    : current;

  return serializeStorefrontAr(evaluation, {
    artworkId,
    current: pointerForUrls,
    glbPresent: assetsPresent,
    usdzPresent: assetsPresent,
    assetOrigin: origin,
  });
}
