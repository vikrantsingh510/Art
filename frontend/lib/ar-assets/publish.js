import { statusBlockReason } from './eligibility.js';
import { isMissingStorageObjectError } from './storage-client.js';
import { sha256Hex } from './hash.js';
import { pointerIsComplete, verifyAssetBuffers, versionPathsFor } from './integrity.js';
import {
  acquirePublishLock,
  assertPublishFence,
  releasePublishLock,
  stagingErrorCopy,
} from './staging.js';
import {
  CURRENT_JSON,
  GLB_CONTENT_TYPE,
  JSON_CONTENT_TYPE,
  MANIFEST_JSON,
  POINTER_CACHE_CONTROL,
  USDZ_CONTENT_TYPE,
  VERSION_CACHE_CONTROL,
  currentPointerPath,
} from './storage-paths.js';

export class ArPublishError extends Error {
  constructor(message, { step = 'unknown' } = {}) {
    super(message);
    this.name = 'ArPublishError';
    this.step = step;
  }
}

async function readJson(storage, objectPath) {
  try {
    const buffer = await storage.download(objectPath);
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    if (isMissingStorageObjectError(error)) {
      return null;
    }
    throw error;
  }
}

async function putImmutable(storage, objectPath, body, contentType, step) {
  const expectedHash = sha256Hex(body);
  const existing = await storage.head(objectPath);
  if (existing) {
    const downloaded = await storage.download(objectPath);
    if (sha256Hex(downloaded) !== expectedHash) {
      throw new ArPublishError(
        `Refusing to overwrite immutable object ${objectPath}.`,
        { step: 'immutable-guard' },
      );
    }
    return { skipped: true };
  }

  try {
    await storage.upload({
      objectPath,
      body,
      contentType,
      upsert: false,
      cacheControl: VERSION_CACHE_CONTROL,
    });
    return { skipped: false };
  } catch (error) {
    if (error?.status === 409 || error?.code === 'already-exists') {
      const downloaded = await storage.download(objectPath);
      if (sha256Hex(downloaded) === expectedHash) {
        return { skipped: true };
      }
      throw new ArPublishError(
        `Immutable object ${objectPath} already exists with different bytes.`,
        { step: 'immutable-guard' },
      );
    }
    throw new ArPublishError(error.message, { step });
  }
}

function customerManifest(generated, paths) {
  return {
    ...generated.manifest,
    files: {
      glb: paths.files.glb,
      usdz: paths.files.usdz,
      texture: null,
    },
  };
}

function currentPointer(generated, paths) {
  return {
    artworkId: generated.manifest.artworkId,
    contentHash: generated.manifest.contentHash,
    ready: true,
    assetsValid: true,
    versionDir: generated.manifest.contentHash,
    files: {
      glb: paths.files.glb,
      usdz: paths.files.usdz,
      texture: null,
      manifest: paths.files.manifest,
    },
    glbSha256: generated.manifest.glbSha256,
    usdzSha256: generated.manifest.usdzSha256,
    sourceImageSha256: generated.manifest.sourceImageSha256,
    updatedAt: new Date().toISOString(),
  };
}

export async function inspectRemoteVersion(storage, artworkId, contentHash, physical) {
  if (!storage || !artworkId || !contentHash) {
    return { valid: false, reason: 'missing-storage' };
  }
  const paths = versionPathsFor(artworkId, contentHash);
  let glb;
  let usdz;
  let manifest;
  try {
    manifest = await readJson(storage, paths.manifest);
    glb = await storage.download(paths.glb);
    usdz = await storage.download(paths.usdz);
  } catch (error) {
    if (isMissingStorageObjectError(error)) {
      return { valid: false, reason: 'missing-assets' };
    }
    return { valid: false, reason: 'download-failed', error: error.message };
  }
  const verified = verifyAssetBuffers({
    glb,
    usdz,
    manifest,
    physical,
  });
  if (!verified.ok) {
    return { valid: false, ...verified, manifest, files: { glb, usdz } };
  }
  return {
    valid: true,
    manifest,
    files: { glb, usdz },
    paths,
    plane: verified.plane,
  };
}

/**
 * Upload an immutable version, verify the stored bytes, then publish
 * current.json last. A partial failure never replaces the previous pointer.
 */
export async function publishArAssetVersion({
  artwork,
  generated,
  storage,
  logger = console,
  expectedContentHash,
  assertFence = null,
} = {}) {
  const artworkId = artwork?.id || generated?.manifest?.artworkId;
  if (!storage) {
    return {
      ok: false,
      published: false,
      skipped: false,
      step: 'storage',
      error: 'A Storage adapter is required.',
      previousCurrent: null,
      current: null,
    };
  }

  let previousCurrent = null;
  if (artworkId) {
    try {
      previousCurrent = await readJson(storage, currentPointerPath(artworkId));
    } catch (error) {
      return {
        ok: false,
        published: false,
        skipped: false,
        step: 'previous-current',
        error: error instanceof Error ? error.message : String(error),
        previousCurrent: null,
        current: null,
      };
    }
  }

  const fail = (step, error) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error?.('[ar-assets] publication failed', {
      artworkId: artworkId || null,
      contentHash: generated?.manifest?.contentHash || null,
      step,
      message,
      previousCurrentHash: previousCurrent?.contentHash || null,
    });
    return {
      ok: false,
      published: false,
      skipped: false,
      step,
      reason: step,
      error: message,
      previousCurrent,
      current: previousCurrent,
    };
  };

  if (!artworkId) {
    return fail('eligibility', 'An artwork id is required.');
  }

  const statusReason = statusBlockReason(artwork?.status);
  if (statusReason) {
    return fail('eligibility', `Artwork status is not customer-facing (${statusReason}).`);
  }
  if (!generated?.assetsValid || !generated?.files?.glb || !generated?.files?.usdz) {
    return fail('validate-local', 'Local GLB/USDZ are missing or invalid.');
  }
  if (!generated.manifest?.contentHash || !generated.manifest?.glbSha256 || !generated.manifest?.usdzSha256) {
    return fail('validate-local', 'Manifest hashes are missing.');
  }
  if (generated.ready !== true) {
    return fail('eligibility', 'Generated assets are not customer AR-ready.');
  }

  const localVerified = verifyAssetBuffers({
    glb: generated.files.glb,
    usdz: generated.files.usdz,
    manifest: generated.manifest,
    physical: generated.physical,
  });
  if (!localVerified.ok) {
    return fail('validate-local', localVerified.error || localVerified.reason);
  }

  const hash = generated.manifest.contentHash;
  const paths = versionPathsFor(artworkId, hash);
  const manifest = customerManifest(generated, paths);

  try {
    await putImmutable(storage, paths.glb, generated.files.glb, GLB_CONTENT_TYPE, 'upload-glb');
  } catch (error) {
    return fail(error.step || 'upload-glb', error);
  }

  try {
    await putImmutable(storage, paths.usdz, generated.files.usdz, USDZ_CONTENT_TYPE, 'upload-usdz');
  } catch (error) {
    return fail(error.step || 'upload-usdz', error);
  }

  let uploadedGlb;
  let uploadedUsdz;
  try {
    uploadedGlb = await storage.download(paths.glb);
    uploadedUsdz = await storage.download(paths.usdz);
  } catch (error) {
    return fail('verify-upload', error);
  }

  const uploadedVerified = verifyAssetBuffers({
    glb: uploadedGlb,
    usdz: uploadedUsdz,
    manifest,
    physical: generated.physical,
  });
  if (!uploadedVerified.ok) {
    return fail('verify-upload', uploadedVerified.error || uploadedVerified.reason);
  }

  try {
    await putImmutable(
      storage,
      paths.manifest,
      Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
      JSON_CONTENT_TYPE,
      'upload-manifest',
    );
  } catch (error) {
    return fail(error.step || 'upload-manifest', error);
  }

  const pointer = currentPointer(generated, paths);
  if (!pointerIsComplete(pointer)) {
    return fail('current-pointer', 'Refusing to publish an incomplete current pointer.');
  }

  if (typeof assertFence === 'function') {
    const fence = await assertFence();
    if (!fence?.ok) {
      return fail(
        fence?.reason || 'stale-fence',
        stagingErrorCopy(fence?.reason || 'stale-fence'),
      );
    }
  }

  const pointerPath = currentPointerPath(artworkId);
  const pointerBody = Buffer.from(`${JSON.stringify(pointer, null, 2)}\n`, 'utf8');
  const coordinated = expectedContentHash !== undefined;

  if (coordinated) {
    const latest = await readJson(storage, pointerPath);
    const latestHash = latest?.contentHash ?? null;
    const expected = expectedContentHash ?? null;
    if (latestHash === hash) {
      return {
        ok: true,
        published: true,
        skipped: true,
        alreadyCurrent: true,
        step: CURRENT_JSON,
        previousCurrent: latest || previousCurrent,
        current: latest || pointer,
        manifest,
        urls: {
          glb: storage.publicUrl?.(paths.glb) || null,
          usdz: storage.publicUrl?.(paths.usdz) || null,
          manifest: storage.publicUrl?.(paths.manifest) || null,
        },
      };
    }
    if (latestHash !== expected) {
      return fail(
        'stale-current',
        'A newer current version was published. This publish was not applied.',
      );
    }

    const createFirstPointer = latest == null;
    try {
      await storage.upload({
        objectPath: pointerPath,
        body: pointerBody,
        contentType: JSON_CONTENT_TYPE,
        upsert: !createFirstPointer,
        cacheControl: POINTER_CACHE_CONTROL,
      });
    } catch (error) {
      if (createFirstPointer && (error?.status === 409 || error?.code === 'already-exists')) {
        return fail(
          'stale-current',
          'A newer current version was published. This publish was not applied.',
        );
      }
      return fail('upload-current', error);
    }
  } else {
    try {
      await storage.upload({
        objectPath: pointerPath,
        body: pointerBody,
        contentType: JSON_CONTENT_TYPE,
        upsert: true,
        cacheControl: POINTER_CACHE_CONTROL,
      });
    } catch (error) {
      return fail('upload-current', error);
    }
  }

  return {
    ok: true,
    published: true,
    skipped: false,
    step: CURRENT_JSON,
    previousCurrent,
    current: pointer,
    manifest,
    urls: {
      glb: storage.publicUrl?.(paths.glb) || null,
      usdz: storage.publicUrl?.(paths.usdz) || null,
      manifest: storage.publicUrl?.(paths.manifest) || null,
    },
  };
}

/**
 * Admin and CLI publication protocol: epoch lock, snapshot, immutable
 * version files, fence, then current.json last. Replacing an existing
 * current.json is still a non-atomic upsert after the fence check.
 */
export async function publishCoordinatedArAssets({
  artwork,
  generated,
  publishStorage,
  lockStorage,
  logger = console,
  now = Date.now(),
  expectedContentHash,
} = {}) {
  const artworkId = artwork?.id || generated?.manifest?.artworkId;
  if (!lockStorage) {
    return {
      ok: false,
      published: false,
      skipped: false,
      step: 'publish-lock',
      reason: 'missing-lock-storage',
      error: 'A staging Storage adapter is required to coordinate publication.',
    };
  }

  let expected = expectedContentHash;
  if (expected === undefined && artworkId && publishStorage) {
    const snapshot = await readJson(publishStorage, currentPointerPath(artworkId));
    expected = snapshot?.contentHash ?? null;
  }

  const lock = await acquirePublishLock(lockStorage, artworkId, { now });
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
    return await publishArAssetVersion({
      artwork,
      generated,
      storage: publishStorage,
      logger,
      expectedContentHash: expected,
      assertFence: () => assertPublishFence(lockStorage, artworkId, {
        epoch: lock.epoch,
        holderId: lock.holderId,
        now: Date.now(),
      }),
    });
  } finally {
    await releasePublishLock(lockStorage, artworkId, {
      holderId: lock.holderId,
      epoch: lock.epoch,
    });
  }
}
