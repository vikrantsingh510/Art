import { randomUUID } from 'node:crypto';
import { sha256Hex } from './hash.js';
import { verifyAssetBuffers } from './integrity.js';
import { isMissingStorageObjectError } from './storage-client.js';
import {
  AR_ASSETS_BUCKET,
  GLB_CONTENT_TYPE,
  GLB_FILE,
  JSON_CONTENT_TYPE,
  MANIFEST_JSON,
  PUBLISH_LOCK_DIR,
  PUBLISH_LOCK_TTL_MS,
  STAGING_JSON,
  STAGING_TTL_MS,
  USDZ_CONTENT_TYPE,
  USDZ_FILE,
  artworkStagingPrefix,
  PUBLISH_LOCK_FILE,
  publishLockEpochPath,
  publishLockPath,
  publishLockPrefix,
  stagingGlbPath,
  stagingManifestPath,
  stagingMetaPath,
  stagingUsdzPath,
} from './storage-paths.js';

export const STAGING_FILE_NAMES = [GLB_FILE, USDZ_FILE, MANIFEST_JSON, STAGING_JSON];

const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const ATTEMPT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function makeAttemptId() {
  return randomUUID();
}

export function makeGenerationId(artworkId, contentHash, attemptId) {
  return `${artworkId}:${contentHash}:${attemptId}`;
}

export function parseGenerationId(generationId, expectedArtworkId = null) {
  if (!generationId || typeof generationId !== 'string') {
    return { ok: false, reason: 'invalid-generation-id' };
  }
  const parts = generationId.split(':');
  if (parts.length !== 3) {
    return { ok: false, reason: 'invalid-generation-id' };
  }
  const [artworkId, contentHash, attemptId] = parts;
  if (!artworkId || !HASH_PATTERN.test(contentHash) || !ATTEMPT_PATTERN.test(attemptId)) {
    return { ok: false, reason: 'invalid-generation-id' };
  }
  if (expectedArtworkId && artworkId !== expectedArtworkId) {
    return { ok: false, reason: 'cross-artwork' };
  }
  return {
    ok: true,
    artworkId,
    contentHash,
    attemptId,
    generationId: makeGenerationId(artworkId, contentHash, attemptId),
  };
}

export function assertStagingStorage(storage) {
  const bucket = storage?.bucket;
  if (!storage || !bucket) {
    throw new Error('A staging Storage adapter is required.');
  }
  if (bucket === AR_ASSETS_BUCKET) {
    throw new Error('Refusing to use the public ar-assets bucket for staging.');
  }
}

function pathParts(objectPath) {
  return String(objectPath || '').split('/').filter(Boolean);
}

export function isPublishLockPath(artworkId, objectPath) {
  const parts = pathParts(objectPath);
  return parts[0] === artworkId
    && parts[1] === PUBLISH_LOCK_DIR
    && parts.length >= 2;
}

export function isAllowedStagingPath(artworkId, objectPath) {
  const parts = pathParts(objectPath);
  if (parts.length !== 4) {
    return false;
  }
  if (parts[0] !== artworkId) {
    return false;
  }
  if (!HASH_PATTERN.test(parts[1]) || !ATTEMPT_PATTERN.test(parts[2])) {
    return false;
  }
  return STAGING_FILE_NAMES.includes(parts[3]);
}

export function stagingErrorCopy(reason) {
  if (reason === 'expired-staging') {
    return 'Staged AR assets expired. Generate them again, then confirm publish.';
  }
  if (reason === 'missing-staging') {
    return 'Staged AR assets were not found. Generate them again, then confirm publish.';
  }
  if (reason === 'cross-artwork') {
    return 'Those generated AR assets belong to a different artwork.';
  }
  if (reason === 'invalid-generation-id') {
    return 'Publishing requires artworkId, generationId and explicit confirm: true.';
  }
  if (reason === 'lock-held') {
    return 'Another publish is in progress for this artwork. Retry shortly.';
  }
  if (reason === 'stale-current') {
    return 'A newer current version was published. This publish was not applied.';
  }
  if (reason === 'stale-fence') {
    return 'Publish lock is no longer held. This publish was not applied.';
  }
  return 'Staged AR assets could not be loaded. Generate them again, then confirm publish.';
}

async function putStagingObject(storage, objectPath, body, contentType) {
  await storage.upload({
    objectPath,
    body,
    contentType,
    upsert: true,
    cacheControl: 'private, no-store',
  });
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

const EPOCH_FILE_PATTERN = /^(\d+)\.json$/;
const MAX_LOCK_ACQUIRE_ATTEMPTS = 3;

function lockDocument(artworkId, holderId, epoch, now, ttlMs) {
  return {
    artworkId,
    holderId,
    epoch,
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    expiresAt: new Date(now + ttlMs).toISOString(),
    expiresAtMs: now + ttlMs,
  };
}

function lockIsExpired(lock, now) {
  if (!lock) {
    return true;
  }
  const expiresAtMs = Number(lock.expiresAtMs) || Date.parse(lock.expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now;
}

function epochFromLockPath(artworkId, objectPath) {
  const parts = pathParts(objectPath);
  let file = null;
  if (parts[0] === artworkId && parts[1] === PUBLISH_LOCK_DIR && parts.length === 3) {
    file = parts[2];
  } else if (parts[0] === PUBLISH_LOCK_DIR && parts.length === 2) {
    file = parts[1];
  } else if (parts.length === 1) {
    file = parts[0];
  }
  if (!file) {
    return null;
  }
  if (file === PUBLISH_LOCK_FILE) {
    return 0;
  }
  const match = EPOCH_FILE_PATTERN.exec(file);
  return match ? Number(match[1]) : null;
}

function objectPathForEpoch(artworkId, epoch) {
  if (epoch === 0) {
    return publishLockPath(artworkId);
  }
  return publishLockEpochPath(artworkId, epoch);
}

async function tryCreateLock(storage, objectPath, document) {
  try {
    await storage.upload({
      objectPath,
      body: Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8'),
      contentType: JSON_CONTENT_TYPE,
      upsert: false,
      cacheControl: 'private, no-store',
    });
    return true;
  } catch (error) {
    if (error?.status === 409 || error?.code === 'already-exists') {
      return false;
    }
    throw error;
  }
}

async function listPublishLocks(storage, artworkId) {
  const prefix = publishLockPrefix(artworkId);
  const paths = typeof storage.list === 'function' ? await storage.list(prefix) : [];
  const seen = new Map();
  for (const objectPath of paths) {
    const epoch = epochFromLockPath(artworkId, objectPath);
    if (epoch == null) {
      continue;
    }
    const resolvedPath = objectPathForEpoch(artworkId, epoch);
    if (!seen.has(epoch)) {
      seen.set(epoch, resolvedPath);
    }
  }
  const locks = [];
  for (const [epoch, objectPath] of seen) {
    const document = await readJson(storage, objectPath);
    locks.push({ epoch, objectPath, document });
  }
  return locks;
}

export async function assertPublishFence(storage, artworkId, {
  epoch,
  holderId,
  now = Date.now(),
} = {}) {
  assertStagingStorage(storage);
  if (!artworkId || !Number.isInteger(epoch) || epoch < 1 || !holderId) {
    return { ok: false, reason: 'stale-fence' };
  }
  const ours = await readJson(storage, publishLockEpochPath(artworkId, epoch));
  if (!ours || ours.holderId !== holderId || Number(ours.epoch) !== epoch || lockIsExpired(ours, now)) {
    return { ok: false, reason: 'stale-fence' };
  }
  const listed = await listPublishLocks(storage, artworkId);
  const live = listed.filter((row) => !lockIsExpired(row.document, now));
  const latestLive = live.reduce((max, row) => Math.max(max, row.epoch), 0);
  if (latestLive !== epoch) {
    return { ok: false, reason: 'stale-fence' };
  }
  return { ok: true, epoch, holderId };
}

export async function acquirePublishLock(storage, artworkId, {
  now = Date.now(),
  ttlMs = PUBLISH_LOCK_TTL_MS,
  holderId = makeAttemptId(),
} = {}) {
  assertStagingStorage(storage);
  if (!artworkId) {
    return { ok: false, reason: 'invalid-artwork' };
  }

  for (let attempt = 0; attempt < MAX_LOCK_ACQUIRE_ATTEMPTS; attempt += 1) {
    const listed = await listPublishLocks(storage, artworkId);
    const live = listed.filter((row) => !lockIsExpired(row.document, now));
    if (live.length > 0) {
      const held = live.reduce((latest, row) => (row.epoch > latest.epoch ? row : latest));
      return {
        ok: false,
        reason: 'lock-held',
        epoch: held.epoch,
        holderId: held.document?.holderId || null,
        expiresAt: held.document?.expiresAt || null,
      };
    }

    const maxEpoch = listed.reduce((max, row) => Math.max(max, row.epoch), 0);
    const epoch = maxEpoch + 1;
    const objectPath = publishLockEpochPath(artworkId, epoch);
    const document = lockDocument(artworkId, holderId, epoch, now, ttlMs);

    if (await tryCreateLock(storage, objectPath, document)) {
      const after = await listPublishLocks(storage, artworkId);
      const liveAfter = after.filter((row) => !lockIsExpired(row.document, now));
      const latestLive = liveAfter.reduce((max, row) => Math.max(max, row.epoch), epoch);
      if (latestLive !== epoch) {
        try {
          await storage.remove(objectPath);
        } catch (error) {
          if (!isMissingStorageObjectError(error)) {
            throw error;
          }
        }
        return { ok: false, reason: 'lock-held' };
      }
      return {
        ok: true,
        holderId,
        epoch,
        lock: document,
        acquired: maxEpoch > 0 ? 'recovered' : 'created',
      };
    }
  }

  return { ok: false, reason: 'lock-held' };
}

export async function releasePublishLock(storage, artworkId, holderIdOrOptions = {}, epochArg = null) {
  assertStagingStorage(storage);
  const options = typeof holderIdOrOptions === 'string'
    ? { holderId: holderIdOrOptions, epoch: epochArg }
    : (holderIdOrOptions || {});
  const holderId = options.holderId;
  const epoch = Number(options.epoch);
  if (!artworkId || !holderId || !Number.isInteger(epoch) || epoch < 1) {
    return { released: false };
  }
  const objectPath = publishLockEpochPath(artworkId, epoch);
  const existing = await readJson(storage, objectPath);
  if (!existing || existing.holderId !== holderId || Number(existing.epoch) !== epoch) {
    return { released: false };
  }
  try {
    await storage.remove(objectPath);
    return { released: true };
  } catch (error) {
    if (isMissingStorageObjectError(error)) {
      return { released: false };
    }
    throw error;
  }
}

export async function dropStagedGeneration(storage, artworkId, contentHash, attemptId) {
  assertStagingStorage(storage);
  if (!artworkId || !HASH_PATTERN.test(contentHash) || !ATTEMPT_PATTERN.test(attemptId)) {
    return { removed: 0 };
  }
  const paths = [
    stagingGlbPath(artworkId, contentHash, attemptId),
    stagingUsdzPath(artworkId, contentHash, attemptId),
    stagingManifestPath(artworkId, contentHash, attemptId),
    stagingMetaPath(artworkId, contentHash, attemptId),
  ];
  let removed = 0;
  for (const objectPath of paths) {
    if (!isAllowedStagingPath(artworkId, objectPath)) {
      continue;
    }
    try {
      const result = await storage.remove(objectPath);
      if (result?.removed !== false) {
        removed += 1;
      }
    } catch (error) {
      if (!isMissingStorageObjectError(error)) {
        throw error;
      }
    }
  }
  return { removed };
}

export async function dropLoadedStaging(storage, meta) {
  assertStagingStorage(storage);
  if (!meta?.artworkId || !HASH_PATTERN.test(meta.contentHash) || !ATTEMPT_PATTERN.test(meta.attemptId)) {
    return { removed: 0, skipped: true };
  }
  const latest = await readJson(
    storage,
    stagingMetaPath(meta.artworkId, meta.contentHash, meta.attemptId),
  );
  if (!latest) {
    return { removed: 0, skipped: true };
  }
  if (
    latest.attemptId !== meta.attemptId
    || latest.generationId !== meta.generationId
    || latest.createdAt !== meta.createdAt
    || latest.contentHash !== meta.contentHash
    || latest.artworkId !== meta.artworkId
  ) {
    return { removed: 0, skipped: true };
  }
  return dropStagedGeneration(storage, meta.artworkId, meta.contentHash, meta.attemptId);
}

export async function stageGeneratedArAssets({
  artworkId,
  generated,
  storage,
  now = Date.now(),
  ttlMs = STAGING_TTL_MS,
  attemptId = makeAttemptId(),
} = {}) {
  assertStagingStorage(storage);
  const contentHash = generated?.manifest?.contentHash;
  if (!artworkId || !HASH_PATTERN.test(contentHash) || !generated?.files?.glb || !generated?.files?.usdz) {
    throw new Error('Generated AR assets are incomplete and cannot be staged.');
  }
  if (!ATTEMPT_PATTERN.test(attemptId)) {
    throw new Error('A unique generation attempt id is required.');
  }
  const generationId = makeGenerationId(artworkId, contentHash, attemptId);

  try {
    await putStagingObject(
      storage,
      stagingGlbPath(artworkId, contentHash, attemptId),
      generated.files.glb,
      GLB_CONTENT_TYPE,
    );
    await putStagingObject(
      storage,
      stagingUsdzPath(artworkId, contentHash, attemptId),
      generated.files.usdz,
      USDZ_CONTENT_TYPE,
    );
    await putStagingObject(
      storage,
      stagingManifestPath(artworkId, contentHash, attemptId),
      Buffer.from(`${JSON.stringify(generated.manifest, null, 2)}\n`, 'utf8'),
      JSON_CONTENT_TYPE,
    );
    const meta = {
      artworkId,
      contentHash,
      attemptId,
      generationId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      expiresAtMs: now + ttlMs,
      sourceImageSha256: generated.manifest.sourceImageSha256 || null,
      glbSha256: generated.manifest.glbSha256,
      usdzSha256: generated.manifest.usdzSha256,
      glbBytes: generated.files.glb.length,
      usdzBytes: generated.files.usdz.length,
      generatorVersion: generated.manifest.generatorVersion || null,
      ready: generated.ready === true,
      assetsValid: generated.assetsValid === true,
    };
    await putStagingObject(
      storage,
      stagingMetaPath(artworkId, contentHash, attemptId),
      Buffer.from(`${JSON.stringify(meta, null, 2)}\n`, 'utf8'),
      JSON_CONTENT_TYPE,
    );
    return {
      ok: true,
      generationId,
      contentHash,
      attemptId,
      expiresAt: meta.expiresAt,
      meta,
    };
  } catch (error) {
    await dropStagedGeneration(storage, artworkId, contentHash, attemptId);
    throw error;
  }
}

export async function loadStagedArAssets({
  storage,
  generationId,
  artworkId,
  now = Date.now(),
} = {}) {
  const parsed = parseGenerationId(generationId, artworkId);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason, generated: null };
  }
  assertStagingStorage(storage);

  const meta = await readJson(
    storage,
    stagingMetaPath(parsed.artworkId, parsed.contentHash, parsed.attemptId),
  );
  if (!meta) {
    return { ok: false, reason: 'missing-staging', generated: null };
  }
  if (
    meta.artworkId !== parsed.artworkId
    || meta.contentHash !== parsed.contentHash
    || meta.attemptId !== parsed.attemptId
    || (meta.generationId && meta.generationId !== parsed.generationId)
  ) {
    return { ok: false, reason: 'cross-artwork', generated: null };
  }
  const expiresAtMs = Number(meta.expiresAtMs) || Date.parse(meta.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
    return { ok: false, reason: 'expired-staging', generated: null };
  }

  let glb;
  let usdz;
  let manifest;
  try {
    glb = await storage.download(stagingGlbPath(parsed.artworkId, parsed.contentHash, parsed.attemptId));
    usdz = await storage.download(stagingUsdzPath(parsed.artworkId, parsed.contentHash, parsed.attemptId));
    manifest = await readJson(
      storage,
      stagingManifestPath(parsed.artworkId, parsed.contentHash, parsed.attemptId),
    );
  } catch (error) {
    if (isMissingStorageObjectError(error)) {
      return { ok: false, reason: 'missing-staging', generated: null };
    }
    throw error;
  }
  if (!manifest) {
    return { ok: false, reason: 'missing-staging', generated: null };
  }
  if (manifest.artworkId && manifest.artworkId !== parsed.artworkId) {
    return { ok: false, reason: 'cross-artwork', generated: null };
  }
  if (meta.glbSha256 && sha256Hex(glb) !== meta.glbSha256) {
    return { ok: false, reason: 'invalid-assets', generated: null };
  }
  if (meta.usdzSha256 && sha256Hex(usdz) !== meta.usdzSha256) {
    return { ok: false, reason: 'invalid-assets', generated: null };
  }

  const verified = verifyAssetBuffers({
    glb,
    usdz,
    manifest,
    physical: manifest,
  });
  if (!verified.ok) {
    return { ok: false, reason: verified.reason || 'invalid-assets', generated: null };
  }

  return {
    ok: true,
    generationId: parsed.generationId,
    contentHash: parsed.contentHash,
    attemptId: parsed.attemptId,
    meta,
    generated: {
      ready: manifest.ready === true,
      generated: true,
      assetsValid: true,
      reasons: manifest.reasons || [],
      physical: {
        ok: true,
        width: manifest.width,
        height: manifest.height,
        depth: manifest.depth ?? null,
        unit: manifest.unit,
        widthM: manifest.widthM,
        heightM: manifest.heightM,
        depthM: manifest.depthM ?? null,
      },
      files: { glb, usdz },
      manifest,
      plane: verified.plane,
    },
  };
}

async function listUnder(storage, prefix) {
  if (typeof storage.list !== 'function') {
    return [];
  }
  return storage.list(prefix);
}

function relativeParts(artworkId, objectPath) {
  const parts = pathParts(objectPath);
  if (parts[0] === artworkId) {
    return parts.slice(1);
  }
  return parts;
}

async function listStagedAttempts(storage, artworkId) {
  const attempts = new Map();
  const add = (contentHash, attemptId) => {
    if (!HASH_PATTERN.test(contentHash) || !ATTEMPT_PATTERN.test(attemptId)) {
      return;
    }
    attempts.set(`${contentHash}/${attemptId}`, { contentHash, attemptId });
  };

  const top = await listUnder(storage, artworkStagingPrefix(artworkId));
  const hashDirs = new Set();
  for (const objectPath of top) {
    const rel = relativeParts(artworkId, objectPath);
    if (rel[0] === PUBLISH_LOCK_DIR) {
      continue;
    }
    if (rel.length >= 2 && HASH_PATTERN.test(rel[0]) && ATTEMPT_PATTERN.test(rel[1])) {
      add(rel[0], rel[1]);
    } else if (rel.length >= 1 && HASH_PATTERN.test(rel[0])) {
      hashDirs.add(rel[0]);
    }
  }

  for (const contentHash of hashDirs) {
    if ([...attempts.values()].some((row) => row.contentHash === contentHash)) {
      continue;
    }
    const nested = await listUnder(storage, `${artworkId}/${contentHash}`);
    for (const objectPath of nested) {
      const rel = relativeParts(artworkId, objectPath);
      if (rel[0] === contentHash && ATTEMPT_PATTERN.test(rel[1])) {
        add(contentHash, rel[1]);
      } else if (ATTEMPT_PATTERN.test(rel[0])) {
        add(contentHash, rel[0]);
      }
    }
  }

  return [...attempts.values()];
}

export async function cleanupExpiredStagingForArtwork(storage, artworkId, {
  now = Date.now(),
} = {}) {
  assertStagingStorage(storage);
  if (!artworkId) {
    return { removedPrefixes: 0 };
  }
  const attempts = await listStagedAttempts(storage, artworkId);
  let removedPrefixes = 0;
  for (const { contentHash, attemptId } of attempts) {
    const meta = await readJson(storage, stagingMetaPath(artworkId, contentHash, attemptId));
    const expiresAtMs = meta
      ? (Number(meta.expiresAtMs) || Date.parse(meta.expiresAt))
      : 0;
    const expired = !meta || !Number.isFinite(expiresAtMs) || expiresAtMs <= now;
    if (expired) {
      await dropStagedGeneration(storage, artworkId, contentHash, attemptId);
      removedPrefixes += 1;
    }
  }
  return { removedPrefixes };
}
