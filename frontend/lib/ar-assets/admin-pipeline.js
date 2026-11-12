import { sha256Hex } from './hash.js';
import { generateArAssets } from './generate.js';
import { inspectRemoteVersion, publishArAssetVersion } from './publish.js';
import { sourceImageMatchesManifest } from './integrity.js';
import { statusBlockReason } from './eligibility-status.js';
import { describeAdminArReadiness } from './admin-preview.js';
import { inspectImageBytes } from '../artwork-image-inspect.js';
import { getSupabaseUrl } from '../env.js';
import { parsePhysicalDimensions } from './physical.js';
import { catalogueMatchesManifest } from './storefront.js';
import { isMissingStorageObjectError } from './storage-client.js';
import { currentPointerPath } from './storage-paths.js';
import {
  acquirePublishLock,
  assertPublishFence,
  dropLoadedStaging,
  dropStagedGeneration,
  loadStagedArAssets,
  parseGenerationId,
  releasePublishLock,
  stagingErrorCopy,
} from './staging.js';

function primaryArtworkImage(artwork) {
  const images = Array.isArray(artwork?.images) ? [...artwork.images] : [];
  images.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
  return images.find((image) => image.isPrimary) || images[0] || null;
}

function publicStorageUrl(storagePath) {
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
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/artwork-images/${String(storagePath).replace(/^\/+/, '')}`;
}

function summarizeGenerated(result, preview) {
  return {
    artworkId: result.manifest?.artworkId || null,
    ready: result.ready === true,
    generated: result.generated === true,
    assetsValid: result.assetsValid === true,
    reasons: result.reasons || [],
    physicalLabel: result.physicalLabel,
    width: result.physical?.width ?? null,
    height: result.physical?.height ?? null,
    depth: result.physical?.depth ?? null,
    unit: result.physical?.unit ?? null,
    imageAspect: preview.imageAspect,
    physicalAspect: preview.physicalAspect,
    deltaPct: preview.deltaPct,
    contentHash: result.manifest?.contentHash || null,
    sourceImageSha256: result.manifest?.sourceImageSha256 || null,
    glbSha256: result.manifest?.glbSha256 || null,
    usdzSha256: result.manifest?.usdzSha256 || null,
    glbBytes: result.manifest?.glbBytes || null,
    usdzBytes: result.manifest?.usdzBytes || null,
    generatorVersion: result.manifest?.generatorVersion || null,
  };
}

export async function loadPrimaryImageBuffer(artwork, fetchImpl = globalThis.fetch) {
  const image = primaryArtworkImage(artwork);
  const url = publicStorageUrl(image?.storagePath);
  if (!url) {
    return { ok: false, reason: 'missing-image', buffer: null, inspection: null };
  }
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) {
    return { ok: false, reason: 'source-image-unavailable', buffer: null, inspection: null };
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const inspection = inspectImageBytes(buffer);
  return { ok: inspection.ok === true, reason: inspection.reason, buffer, inspection };
}

export function previewArtworkAr(artwork, inspection) {
  return describeAdminArReadiness({
    width: artwork?.width,
    height: artwork?.height,
    depth: artwork?.depth,
    unit: artwork?.dimensionUnit,
    dimensionUnit: artwork?.dimensionUnit,
    status: artwork?.status,
    pixels: inspection?.width ? { width: inspection.width, height: inspection.height } : null,
    imageKind: inspection?.kind || null,
    imageOk: inspection ? inspection.ok : false,
  });
}

export async function generateAdminArAssets(artwork, { fetchImpl = globalThis.fetch } = {}) {
  const loaded = await loadPrimaryImageBuffer(artwork, fetchImpl);
  const preview = previewArtworkAr(artwork, loaded.inspection);
  if (!loaded.ok || !loaded.buffer) {
    return {
      ok: false,
      step: 'source-image',
      error: 'A valid JPEG or PNG catalogue image is required before AR generation.',
      preview,
      summary: null,
      generated: null,
    };
  }
  if (!preview.canGenerate) {
    return {
      ok: false,
      step: 'eligibility',
      error: preview.explanation || 'This artwork is not eligible for AR generation.',
      preview,
      summary: null,
      generated: null,
    };
  }

  try {
    const generated = await generateArAssets({
      artworkId: artwork.id,
      status: artwork.status,
      width: artwork.width,
      height: artwork.height,
      depth: artwork.depth,
      unit: artwork.dimensionUnit,
      imageBuffer: loaded.buffer,
      title: artwork.title,
    });
    if (!generated.generated || !generated.assetsValid) {
      return {
        ok: false,
        step: 'generate',
        error: 'AR meshes could not be generated. The artwork record was not changed.',
        preview,
        summary: summarizeGenerated(generated, preview),
        generated,
      };
    }
    return {
      ok: true,
      step: 'generate',
      preview,
      summary: summarizeGenerated(generated, preview),
      generated,
      sourceImageSha256: sha256Hex(loaded.buffer),
    };
  } catch (error) {
    return {
      ok: false,
      step: 'generate',
      error: error.message || 'AR generation failed. The artwork record was not changed.',
      preview,
      summary: null,
      generated: null,
    };
  }
}

export async function publishAdminArAssets({
  artwork,
  generated,
  storage,
  logger = { error() {} },
} = {}) {
  const blocked = statusBlockReason(artwork?.status);
  if (blocked) {
    return {
      ok: false,
      published: false,
      skipped: true,
      step: 'eligibility',
      error: `Not publishing to customer Storage (${blocked}).`,
    };
  }
  return publishArAssetVersion({
    artwork,
    generated,
    storage,
    logger,
  });
}

async function readPointer(storage, artworkId) {
  try {
    const buffer = await storage.download(currentPointerPath(artworkId));
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    if (isMissingStorageObjectError(error)) {
      return null;
    }
    throw error;
  }
}

export async function publishStagedArAssets({
  artwork,
  generationId,
  stagingStorage,
  publishStorage,
  sourceImageBuffer = null,
  logger = { error() {} },
  now = Date.now(),
} = {}) {
  const parsed = parseGenerationId(generationId, artwork?.id);
  if (!parsed.ok) {
    return {
      ok: false,
      published: false,
      skipped: false,
      step: 'generation-id',
      reason: parsed.reason,
      error: stagingErrorCopy(parsed.reason),
    };
  }

  const blocked = statusBlockReason(artwork?.status);
  if (blocked) {
    return {
      ok: false,
      published: false,
      skipped: true,
      step: 'eligibility',
      error: `Not publishing to customer Storage (${blocked}).`,
    };
  }

  const expectedPointer = await readPointer(publishStorage, artwork.id);
  const expectedContentHash = expectedPointer?.contentHash ?? null;

  const lock = await acquirePublishLock(stagingStorage, artwork.id, { now });
  if (!lock.ok) {
    return {
      ok: false,
      published: false,
      skipped: false,
      step: 'publish-lock',
      reason: lock.reason || 'lock-held',
      error: stagingErrorCopy(lock.reason || 'lock-held'),
    };
  }

  try {
    const physical = parsePhysicalDimensions(artwork);
    const staged = await loadStagedArAssets({
      storage: stagingStorage,
      generationId,
      artworkId: artwork.id,
      now,
    });

    if (!staged.ok) {
      if (staged.reason === 'missing-staging' || staged.reason === 'expired-staging') {
        const current = await readPointer(publishStorage, artwork.id);
        if (current?.contentHash === parsed.contentHash) {
          const remote = await inspectRemoteVersion(
            publishStorage,
            artwork.id,
            parsed.contentHash,
            physical.ok ? physical : null,
          );
          if (remote.valid) {
            await dropStagedGeneration(
              stagingStorage,
              parsed.artworkId,
              parsed.contentHash,
              parsed.attemptId,
            );
            return {
              ok: true,
              published: true,
              skipped: true,
              alreadyCurrent: true,
              step: 'current.json',
              current,
            };
          }
        }
      }
      return {
        ok: false,
        published: false,
        skipped: false,
        step: 'staging',
        reason: staged.reason,
        error: stagingErrorCopy(staged.reason),
      };
    }

    if (sourceImageBuffer?.length) {
      if (!sourceImageMatchesManifest(sourceImageBuffer, staged.generated.manifest)) {
        return {
          ok: false,
          published: false,
          skipped: false,
          step: 'stale-source-image',
          error: 'The catalogue image no longer matches the staged AR assets. Generate them again.',
        };
      }
    } else {
      return {
        ok: false,
        published: false,
        skipped: false,
        step: 'source-image',
        error: 'A valid JPEG or PNG catalogue image is required before AR publishing.',
      };
    }

    if (!catalogueMatchesManifest(artwork, staged.generated.manifest)) {
      return {
        ok: false,
        published: false,
        skipped: false,
        step: 'stale-hash',
        error: 'Catalogue dimensions no longer match the staged AR assets. Generate them again.',
      };
    }

    const published = await publishArAssetVersion({
      artwork,
      generated: staged.generated,
      storage: publishStorage,
      logger,
      expectedContentHash,
      assertFence: () => assertPublishFence(stagingStorage, artwork.id, {
        epoch: lock.epoch,
        holderId: lock.holderId,
        now: Date.now(),
      }),
    });
    if (published.ok) {
      await dropLoadedStaging(stagingStorage, staged.meta);
    }
    return published;
  } finally {
    await releasePublishLock(stagingStorage, artwork.id, {
      holderId: lock.holderId,
      epoch: lock.epoch,
    });
  }
}
