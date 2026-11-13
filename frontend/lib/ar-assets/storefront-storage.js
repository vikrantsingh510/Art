import { getSupabaseUrl } from '../env.js';
import { sha256Hex } from './hash.js';
import { catalogueIntegrityReasons, pointerIsComplete } from './integrity.js';
import {
  arAssetsPublicOrigin,
  currentPointerPath,
  publicObjectUrl,
  versionGlbPath,
  versionManifestPath,
  versionUsdzPath,
} from './storage-paths.js';
import { evaluateStorefrontAr, serializeStorefrontAr } from './storefront.js';

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

function primaryCatalogueImage(artwork) {
  const images = Array.isArray(artwork?.images) ? [...artwork.images] : [];
  images.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
  return images.find((image) => image.isPrimary) || images[0] || null;
}

function timestampMs(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function declaredSourceBytes(manifest) {
  const bytes = Number(manifest?.texture?.sourceBytes);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
}

function catalogueImageUrl(artwork) {
  const chosen = primaryCatalogueImage(artwork);
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

async function readJsonFromStorage(storage, objectPath) {
  try {
    const buffer = await storage.download(objectPath);
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

function parseContentRangeTotal(contentRange) {
  const match = /\/(\d+)\s*$/.exec(String(contentRange || ''));
  return match ? Number(match[1]) : null;
}

async function cancelBody(response) {
  try {
    if (response?.body && typeof response.body.cancel === 'function') {
      await response.body.cancel();
    }
  } catch {
    // Headers-only probes must not retain a body.
  }
}

/**
 * Confirm a published object exists without buffering it. Publication already
 * hashed GLB/USDZ and only then wrote current.json. Storefront re-checks
 * existence and declared byte length, not file contents.
 */
async function headRemoteAsset(url, fetchImpl) {
  if (!url) {
    return null;
  }
  try {
    const head = await fetchImpl(url, { method: 'HEAD', cache: 'no-store' });
    if (head.status === 405 || head.status === 501) {
      const ranged = await fetchImpl(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        cache: 'no-store',
      });
      await cancelBody(ranged);
      if (ranged.status !== 200 && ranged.status !== 206) {
        return null;
      }
      const total = parseContentRangeTotal(ranged.headers.get('content-range'));
      const length = Number(ranged.headers.get('content-length'));
      return {
        size: Number.isFinite(total) && total > 0
          ? total
          : (Number.isFinite(length) ? length : null),
        contentType: ranged.headers.get('content-type'),
      };
    }
    await cancelBody(head);
    if (!head.ok) {
      return null;
    }
    const length = Number(head.headers.get('content-length'));
    return {
      size: Number.isFinite(length) ? length : null,
      contentType: head.headers.get('content-type'),
    };
  } catch {
    return null;
  }
}

async function headStoredAsset(storage, objectPath) {
  if (!storage || !objectPath) {
    return null;
  }
  try {
    if (typeof storage.head === 'function') {
      const meta = await storage.head(objectPath);
      if (!meta) {
        return null;
      }
      return {
        size: Number.isFinite(Number(meta.size)) ? Number(meta.size) : null,
        contentType: meta.contentType || null,
      };
    }
    await storage.download(objectPath);
    return { size: null, contentType: null };
  } catch {
    return null;
  }
}

function remoteAssetLooksValid(meta, expectedBytes) {
  if (!meta) {
    return { ok: false, reason: 'missing-assets' };
  }
  if (Number.isFinite(meta.size) && meta.size <= 0) {
    return { ok: false, reason: 'missing-assets' };
  }
  if (Number.isFinite(expectedBytes) && expectedBytes > 0 && Number.isFinite(meta.size) && meta.size > 0) {
    if (meta.size !== expectedBytes) {
      return { ok: false, reason: 'invalid-assets' };
    }
  }
  return { ok: true };
}

function catalogueSourceReasons({
  manifest,
  primaryImage,
  sourceMeta,
  sourceBuffer,
}) {
  const reasons = [];
  const expectedBytes = declaredSourceBytes(manifest);
  if (!expectedBytes) {
    reasons.push('source-image-unavailable');
    return reasons;
  }

  if (sourceBuffer?.length) {
    if (sourceBuffer.length !== expectedBytes) {
      reasons.push('stale-source-image');
    }
    return reasons;
  }

  if (!sourceMeta || !Number.isFinite(sourceMeta.size) || sourceMeta.size <= 0) {
    reasons.push('source-image-unavailable');
    return reasons;
  }
  if (sourceMeta.size !== expectedBytes) {
    reasons.push('stale-source-image');
  }

  const createdAt = timestampMs(primaryImage?.createdAt);
  const generatedAt = timestampMs(manifest?.generatedAt);
  if (createdAt != null && generatedAt != null && createdAt > generatedAt) {
    reasons.push('stale-source-image');
  }
  return reasons;
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

  const sourceBuffer = sourceImageBuffer;
  const primaryImage = primaryCatalogueImage(artwork);
  const imageUrl = catalogueImageUrl(artwork);
  const hasCatalogueImage = Boolean(imageUrl || primaryImage);

  const integrityReasons = catalogueIntegrityReasons(artwork, manifest, {
    sourceImageBuffer: sourceBuffer,
    sourceImageRequired: Boolean(sourceBuffer) && Boolean(current && hasCatalogueImage),
  });

  let sourceMeta = null;
  if (current && hasCatalogueImage && !sourceBuffer?.length) {
    sourceMeta = imageUrl ? await headRemoteAsset(imageUrl, fetchImpl) : null;
  }
  if (current && hasCatalogueImage) {
    integrityReasons.push(...catalogueSourceReasons({
      manifest,
      primaryImage,
      sourceMeta,
      sourceBuffer,
    }));
  }

  const contentHash = manifest?.contentHash || current?.contentHash || versionDir;
  const glbRel = manifest?.files?.glb || current?.files?.glb || null;
  const usdzRel = manifest?.files?.usdz || current?.files?.usdz || null;
  const glbPath = glbRel
    ? prefixedObjectPath(artworkId, glbRel)
    : (contentHash ? versionGlbPath(artworkId, contentHash) : null);
  const usdzPath = usdzRel
    ? prefixedObjectPath(artworkId, usdzRel)
    : (contentHash ? versionUsdzPath(artworkId, contentHash) : null);

  let remoteVerified = { ok: Boolean(current?.files?.glb && current?.files?.usdz) };
  if (verifyRemoteAssets && glbPath && usdzPath) {
    const [glbMeta, usdzMeta] = storage
      ? await Promise.all([
        headStoredAsset(storage, glbPath),
        headStoredAsset(storage, usdzPath),
      ])
      : await Promise.all([
        headRemoteAsset(publicObjectUrl(origin, glbPath), fetchImpl),
        headRemoteAsset(publicObjectUrl(origin, usdzPath), fetchImpl),
      ]);
    const glbCheck = remoteAssetLooksValid(glbMeta, manifest?.glbBytes);
    const usdzCheck = remoteAssetLooksValid(usdzMeta, manifest?.usdzBytes);
    if (!glbCheck.ok || !usdzCheck.ok) {
      remoteVerified = { ok: false, reason: glbCheck.reason || usdzCheck.reason || 'missing-assets' };
    } else {
      remoteVerified = { ok: true };
    }
  }

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
