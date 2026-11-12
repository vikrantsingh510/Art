import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { publishStagedArAssets } from '../lib/ar-assets/admin-pipeline.js';
import { generateArAssets } from '../lib/ar-assets/generate.js';
import { publishArAssetVersion, publishCoordinatedArAssets } from '../lib/ar-assets/publish.js';
import {
  acquirePublishLock,
  assertPublishFence,
  assertStagingStorage,
  cleanupExpiredStagingForArtwork,
  dropStagedGeneration,
  loadStagedArAssets,
  makeGenerationId,
  parseGenerationId,
  releasePublishLock,
  stageGeneratedArAssets,
} from '../lib/ar-assets/staging.js';
import { createMemoryArStorage } from '../lib/ar-assets/storage-client.js';
import {
  AR_ASSETS_BUCKET,
  AR_ASSETS_STAGING_BUCKET,
  currentPointerPath,
  publishLockEpochPath,
  stagingGlbPath,
  stagingManifestPath,
  stagingMetaPath,
  stagingUsdzPath,
  versionGlbPath,
} from '../lib/ar-assets/storage-paths.js';
import { resolveArtworkArAssets } from '../lib/ar-assets/storefront-storage.js';

const silentLogger = { error() {}, info() {}, warn() {} };
const ASSET_ORIGIN = 'https://example.supabase.co/storage/v1/object/public/ar-assets';
const LOTUS_ID = '8f3171f4-acbf-4024-a8d8-c7471b3644d5';
const LOTUS_HASH = 'd4a10f4be2fd4f9ebb074a9693ccdde23fed036b869e856e7e981bfb7193b707';

async function makeJpeg(width, height, tint = { r: 160, g: 120, b: 90 }) {
  return sharp({
    create: { width, height, channels: 3, background: tint },
  }).jpeg({ quality: 90 }).toBuffer();
}

function matchingArtwork(overrides = {}) {
  return {
    id: '20015000-0000-4000-8000-000000000001',
    status: 'published',
    width: 200,
    height: 150,
    depth: 4,
    dimensionUnit: 'cm',
    images: [{ id: 'img-1', storagePath: 'lot/one.jpg', isPrimary: true }],
    ...overrides,
  };
}

function createStagingStorage() {
  return createMemoryArStorage({
    bucket: AR_ASSETS_STAGING_BUCKET,
    publicOrigin: 'https://example.supabase.co/storage/v1/object/authenticated/ar-assets-staging',
  });
}

function createPublishStorage() {
  return createMemoryArStorage({
    bucket: AR_ASSETS_BUCKET,
    publicOrigin: ASSET_ORIGIN,
  });
}

function wrapStorage(inner, overrides = {}) {
  return {
    bucket: inner.bucket,
    objects: inner.objects,
    publicOrigin: inner.publicOrigin,
    getBucket: inner.getBucket.bind(inner),
    upload: inner.upload.bind(inner),
    download: inner.download.bind(inner),
    head: inner.head.bind(inner),
    list: inner.list.bind(inner),
    remove: inner.remove.bind(inner),
    publicUrl: inner.publicUrl.bind(inner),
    ...overrides,
  };
}

async function generateMatching(artwork, jpeg) {
  return generateArAssets({
    artworkId: artwork.id,
    status: artwork.status,
    width: artwork.width,
    height: artwork.height,
    depth: artwork.depth,
    unit: artwork.dimensionUnit,
    imageBuffer: jpeg,
  });
}

function stagingHas(storage, artworkId, contentHash, attemptId) {
  return storage.objects.has(stagingMetaPath(artworkId, contentHash, attemptId))
    && storage.objects.has(stagingGlbPath(artworkId, contentHash, attemptId))
    && storage.objects.has(stagingUsdzPath(artworkId, contentHash, attemptId))
    && storage.objects.has(stagingManifestPath(artworkId, contentHash, attemptId));
}

function currentHash(storage, artworkId) {
  const row = storage.objects.get(currentPointerPath(artworkId));
  if (!row) {
    return null;
  }
  return JSON.parse(row.body.toString('utf8')).contentHash;
}

function lockKeys(storage, artworkId) {
  const prefix = `${artworkId}/_lock/`;
  return [...storage.objects.keys()].filter((key) => key.startsWith(prefix));
}

async function plantLotus(publishStorage) {
  const pointer = {
    artworkId: LOTUS_ID,
    contentHash: LOTUS_HASH,
    ready: true,
    assetsValid: true,
    versionDir: LOTUS_HASH,
    files: {
      glb: `${LOTUS_HASH}/painting.glb`,
      usdz: `${LOTUS_HASH}/painting.usdz`,
      manifest: `${LOTUS_HASH}/manifest.json`,
    },
  };
  await publishStorage.upload({
    objectPath: currentPointerPath(LOTUS_ID),
    body: Buffer.from(`${JSON.stringify(pointer)}\n`),
    contentType: 'application/json',
    upsert: true,
  });
  await publishStorage.upload({
    objectPath: versionGlbPath(LOTUS_ID, LOTUS_HASH),
    body: Buffer.from('lotus-glb'),
    contentType: 'model/gltf-binary',
    upsert: true,
  });
}

test('parseGenerationId rejects cross-artwork and malformed ids', () => {
  const artwork = matchingArtwork();
  const hash = 'a'.repeat(64);
  const attemptId = '11111111-1111-4111-8111-111111111111';
  const parsed = parseGenerationId(makeGenerationId(artwork.id, hash, attemptId), artwork.id);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.attemptId, attemptId);
  assert.equal(
    parseGenerationId(makeGenerationId(artwork.id, hash, attemptId), 'other-id').reason,
    'cross-artwork',
  );
  assert.equal(parseGenerationId('not-an-id', artwork.id).ok, false);
  assert.equal(parseGenerationId(`${artwork.id}:short`, artwork.id).ok, false);
  assert.equal(parseGenerationId(`${artwork.id}:${hash}`, artwork.id).ok, false);
});

test('staging helpers refuse the public ar-assets bucket', () => {
  const publishStorage = createPublishStorage();
  assert.throws(() => assertStagingStorage(publishStorage), /public ar-assets/);
});

test('generate then stage then publish deletes only staging files', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  await plantLotus(publishing);

  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
  });
  assert.equal(staged.ok, true);
  assert.equal(stagingHas(staging, artwork.id, generated.manifest.contentHash, staged.attemptId), true);

  const published = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  assert.equal(published.ok, true);
  assert.equal(published.published, true);
  assert.equal(stagingHas(staging, artwork.id, generated.manifest.contentHash, staged.attemptId), false);
  assert.ok(publishing.objects.has(currentPointerPath(artwork.id)));
  assert.ok(publishing.objects.has(versionGlbPath(artwork.id, generated.manifest.contentHash)));
  assert.ok(publishing.objects.has(currentPointerPath(LOTUS_ID)));
  assert.ok(publishing.objects.has(versionGlbPath(LOTUS_ID, LOTUS_HASH)));
});

test('publish from a different instance with no shared memory', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
  });

  const isolatedGenerated = null;
  assert.equal(isolatedGenerated, null);

  const published = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  assert.equal(published.ok, true);
  assert.equal(published.current.contentHash, generated.manifest.contentHash);
});

test('publish retry after failure keeps staging and previous current', async () => {
  const artwork = matchingArtwork();
  const firstJpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const first = await generateMatching(artwork, firstJpeg);
  const staging = createStagingStorage();
  const inner = createPublishStorage();
  await plantLotus(inner);
  await publishArAssetVersion({
    artwork,
    generated: first,
    storage: inner,
    logger: silentLogger,
  });
  const previous = JSON.parse(inner.objects.get(currentPointerPath(artwork.id)).body.toString('utf8'));

  const secondJpeg = await makeJpeg(200, 150, { r: 12, g: 80, b: 200 });
  const second = await generateMatching(artwork, secondJpeg);
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated: second,
    storage: staging,
  });

  const failing = wrapStorage(inner, {
    async upload(args) {
      if (String(args.objectPath) === currentPointerPath(artwork.id)) {
        const pointer = JSON.parse(args.body.toString('utf8'));
        if (pointer.contentHash === second.manifest.contentHash) {
          throw new Error('current.json upload failed');
        }
      }
      return inner.upload(args);
    },
  });

  const failed = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: failing,
    sourceImageBuffer: secondJpeg,
    logger: silentLogger,
  });
  assert.equal(failed.ok, false);
  assert.equal(stagingHas(staging, artwork.id, second.manifest.contentHash, staged.attemptId), true);
  const afterFail = JSON.parse(inner.objects.get(currentPointerPath(artwork.id)).body.toString('utf8'));
  assert.equal(afterFail.contentHash, previous.contentHash);
  assert.ok(inner.objects.has(currentPointerPath(LOTUS_ID)));
  assert.equal(lockKeys(staging, artwork.id).length, 0);

  const retried = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: inner,
    sourceImageBuffer: secondJpeg,
    logger: silentLogger,
  });
  assert.equal(retried.ok, true);
  assert.equal(stagingHas(staging, artwork.id, second.manifest.contentHash, staged.attemptId), false);
  assert.equal(lockKeys(staging, artwork.id).length, 0);
});

test('expired staging is rejected and current.json is unchanged', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
    now: 1_000,
    ttlMs: 30,
  });
  const loaded = await loadStagedArAssets({
    storage: staging,
    generationId: staged.generationId,
    artworkId: artwork.id,
    now: 2_000,
  });
  assert.equal(loaded.ok, false);
  assert.equal(loaded.reason, 'expired-staging');

  const published = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
    now: 2_000,
  });
  assert.equal(published.ok, false);
  assert.equal(published.reason, 'expired-staging');
  assert.equal(publishing.objects.has(currentPointerPath(artwork.id)), false);
});

test('missing staging metadata is rejected', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
  });
  await staging.remove(stagingMetaPath(artwork.id, generated.manifest.contentHash, staged.attemptId));
  const loaded = await loadStagedArAssets({
    storage: staging,
    generationId: staged.generationId,
    artworkId: artwork.id,
  });
  assert.equal(loaded.ok, false);
  assert.equal(loaded.reason, 'missing-staging');
  const published = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  assert.equal(published.ok, false);
  assert.equal(published.reason, 'missing-staging');
});

test('cross-artwork generation id is rejected', async () => {
  const artwork = matchingArtwork();
  const other = matchingArtwork({ id: '30015000-0000-4000-8000-000000000002' });
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
  });
  const published = await publishStagedArAssets({
    artwork: other,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  assert.equal(published.ok, false);
  assert.equal(published.reason, 'cross-artwork');
  assert.equal(stagingHas(staging, artwork.id, generated.manifest.contentHash, staged.attemptId), true);
  assert.equal(publishing.objects.has(currentPointerPath(other.id)), false);
});

test('partial staging upload is cleaned up', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const inner = createStagingStorage();
  const storage = wrapStorage(inner, {
    async upload(args) {
      if (String(args.objectPath).endsWith('.usdz')) {
        throw new Error('USDZ staging failed');
      }
      return inner.upload(args);
    },
  });
  await assert.rejects(
    () => stageGeneratedArAssets({
      artworkId: artwork.id,
      generated,
      storage,
    }),
    /USDZ staging failed/,
  );
  const leftover = [...inner.objects.keys()].filter((key) => !key.includes('/_lock/'));
  assert.equal(leftover.length, 0);
});

test('duplicate publish after success is idempotent', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
  });
  const first = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  assert.equal(first.ok, true);
  const second = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  assert.equal(second.ok, true);
  assert.equal(second.alreadyCurrent, true);
  assert.equal(second.current.contentHash, generated.manifest.contentHash);
});

test('expired abandoned staging is cleaned only under that artwork prefix', async () => {
  const artwork = matchingArtwork();
  const other = matchingArtwork({ id: '30015000-0000-4000-8000-000000000002' });
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const otherGenerated = await generateMatching(other, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  await plantLotus(publishing);

  const expired = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
    now: 1_000,
    ttlMs: 10,
  });
  const kept = await stageGeneratedArAssets({
    artworkId: other.id,
    generated: otherGenerated,
    storage: staging,
    now: 1_000,
    ttlMs: 10_000_000,
  });

  const cleaned = await cleanupExpiredStagingForArtwork(staging, artwork.id, { now: 5_000 });
  assert.equal(cleaned.removedPrefixes, 1);
  assert.equal(stagingHas(staging, artwork.id, generated.manifest.contentHash, expired.attemptId), false);
  assert.equal(stagingHas(staging, other.id, otherGenerated.manifest.contentHash, kept.attemptId), true);
  assert.ok(publishing.objects.has(currentPointerPath(LOTUS_ID)));
  assert.ok(publishing.objects.has(versionGlbPath(LOTUS_ID, LOTUS_HASH)));
});

test('storefront ignores staging objects and follows current.json', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
  });
  const unpublished = await resolveArtworkArAssets(artwork, {
    storage: publishing,
    origin: ASSET_ORIGIN,
    sourceImageBuffer: jpeg,
  });
  assert.equal(unpublished.ready, false);

  await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  await publishing.upload({
    objectPath: `${artwork.id}/_staging/${generated.manifest.contentHash}/painting.glb`,
    body: Buffer.from('not-a-customer-file'),
    contentType: 'model/gltf-binary',
    upsert: true,
  });
  const ar = await resolveArtworkArAssets(artwork, {
    storage: publishing,
    origin: ASSET_ORIGIN,
    sourceImageBuffer: jpeg,
  });
  assert.equal(ar.ready, true);
  assert.equal(ar.contentHash, generated.manifest.contentHash);
  assert.match(ar.glbUrl, new RegExp(`${generated.manifest.contentHash}/painting\\.glb`));
  assert.doesNotMatch(ar.glbUrl, /_staging/);
});

test('CLI publishArAssetVersion still publishes without staging', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const publishing = createPublishStorage();
  const published = await publishArAssetVersion({
    artwork,
    generated,
    storage: publishing,
    logger: silentLogger,
  });
  assert.equal(published.ok, true);
  assert.ok(publishing.objects.has(currentPointerPath(artwork.id)));
});

test('dropStagedGeneration never deletes current.json', async () => {
  const artwork = matchingArtwork();
  const staging = createStagingStorage();
  await staging.upload({
    objectPath: currentPointerPath(artwork.id),
    body: Buffer.from('{"ready":true}\n'),
    contentType: 'application/json',
    upsert: true,
  });
  await dropStagedGeneration(
    staging,
    artwork.id,
    'b'.repeat(64),
    '11111111-1111-4111-8111-111111111111',
  );
  assert.equal(staging.objects.has(currentPointerPath(artwork.id)), true);
});

test('concurrent generate of the same artwork and hash keeps both attempts', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const [first, second] = await Promise.all([
    stageGeneratedArAssets({ artworkId: artwork.id, generated, storage: staging }),
    stageGeneratedArAssets({ artworkId: artwork.id, generated, storage: staging }),
  ]);
  assert.notEqual(first.attemptId, second.attemptId);
  assert.notEqual(first.generationId, second.generationId);
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(stagingHas(staging, artwork.id, first.contentHash, first.attemptId), true);
  assert.equal(stagingHas(staging, artwork.id, second.contentHash, second.attemptId), true);
});

test('concurrent generate of different hashes keeps both prefixes', async () => {
  const artwork = matchingArtwork();
  const firstJpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const secondJpeg = await makeJpeg(200, 150, { r: 12, g: 80, b: 200 });
  const firstGenerated = await generateMatching(artwork, firstJpeg);
  const secondGenerated = await generateMatching(artwork, secondJpeg);
  const staging = createStagingStorage();
  const [first, second] = await Promise.all([
    stageGeneratedArAssets({ artworkId: artwork.id, generated: firstGenerated, storage: staging }),
    stageGeneratedArAssets({ artworkId: artwork.id, generated: secondGenerated, storage: staging }),
  ]);
  assert.notEqual(first.contentHash, second.contentHash);
  assert.equal(stagingHas(staging, artwork.id, first.contentHash, first.attemptId), true);
  assert.equal(stagingHas(staging, artwork.id, second.contentHash, second.attemptId), true);
});

test('publish A completing while generate B is in progress leaves B staged', async () => {
  const artwork = matchingArtwork();
  const firstJpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const secondJpeg = await makeJpeg(200, 150, { r: 12, g: 80, b: 200 });
  const firstGenerated = await generateMatching(artwork, firstJpeg);
  const secondGenerated = await generateMatching(artwork, secondJpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const stagedA = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated: firstGenerated,
    storage: staging,
  });
  const [publishedA, stagedB] = await Promise.all([
    publishStagedArAssets({
      artwork,
      generationId: stagedA.generationId,
      stagingStorage: staging,
      publishStorage: publishing,
      sourceImageBuffer: firstJpeg,
      logger: silentLogger,
    }),
    stageGeneratedArAssets({
      artworkId: artwork.id,
      generated: secondGenerated,
      storage: staging,
    }),
  ]);
  assert.equal(publishedA.ok, true);
  assert.equal(stagingHas(staging, artwork.id, firstGenerated.manifest.contentHash, stagedA.attemptId), false);
  assert.equal(stagingHas(staging, artwork.id, secondGenerated.manifest.contentHash, stagedB.attemptId), true);
  assert.equal(currentHash(publishing, artwork.id), firstGenerated.manifest.contentHash);
});

test('concurrent publish of different versions serializes current.json', async () => {
  const artwork = matchingArtwork();
  const firstJpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const secondJpeg = await makeJpeg(200, 150, { r: 12, g: 80, b: 200 });
  const firstGenerated = await generateMatching(artwork, firstJpeg);
  const secondGenerated = await generateMatching(artwork, secondJpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const stagedA = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated: firstGenerated,
    storage: staging,
  });
  const stagedB = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated: secondGenerated,
    storage: staging,
  });
  const [first, second] = await Promise.all([
    publishStagedArAssets({
      artwork,
      generationId: stagedA.generationId,
      stagingStorage: staging,
      publishStorage: publishing,
      sourceImageBuffer: firstJpeg,
      logger: silentLogger,
    }),
    publishStagedArAssets({
      artwork,
      generationId: stagedB.generationId,
      stagingStorage: staging,
      publishStorage: publishing,
      sourceImageBuffer: secondJpeg,
      logger: silentLogger,
    }),
  ]);
  const results = [first, second];
  const winners = results.filter((result) => result.ok);
  const losers = results.filter((result) => !result.ok);
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.ok(['lock-held', 'stale-current'].includes(losers[0].reason));
  assert.equal(currentHash(publishing, artwork.id), winners[0].current.contentHash);
  assert.ok([
    firstGenerated.manifest.contentHash,
    secondGenerated.manifest.contentHash,
  ].includes(currentHash(publishing, artwork.id)));
});

test('concurrent lock acquisition grants one epoch and rejects the other', async () => {
  const artwork = matchingArtwork();
  const staging = createStagingStorage();
  const [first, second] = await Promise.all([
    acquirePublishLock(staging, artwork.id, {
      now: 1_000,
      ttlMs: 90_000,
      holderId: '11111111-1111-4111-8111-111111111111',
    }),
    acquirePublishLock(staging, artwork.id, {
      now: 1_000,
      ttlMs: 90_000,
      holderId: '22222222-2222-4222-8222-222222222222',
    }),
  ]);
  const results = [first, second];
  const winners = results.filter((result) => result.ok);
  const losers = results.filter((result) => !result.ok);
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.equal(losers[0].reason, 'lock-held');
  assert.equal(winners[0].epoch, 1);
  assert.equal(staging.objects.has(publishLockEpochPath(artwork.id, 1)), true);
  await releasePublishLock(staging, artwork.id, {
    holderId: winners[0].holderId,
    epoch: winners[0].epoch,
  });
  const third = await acquirePublishLock(staging, artwork.id, {
    now: 1_000,
    ttlMs: 90_000,
    holderId: '33333333-3333-4333-8333-333333333333',
  });
  assert.equal(third.ok, true);
  assert.equal(third.holderId, '33333333-3333-4333-8333-333333333333');
});

test('lock is released after publish failure', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const inner = createPublishStorage();
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
  });
  const failing = wrapStorage(inner, {
    async upload(args) {
      if (String(args.objectPath) === currentPointerPath(artwork.id)) {
        throw new Error('current.json upload failed');
      }
      return inner.upload(args);
    },
  });
  const failed = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: failing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  assert.equal(failed.ok, false);
  assert.equal(lockKeys(staging, artwork.id).length, 0);
  const recovered = await acquirePublishLock(staging, artwork.id, {
    holderId: '44444444-4444-4444-8444-444444444444',
  });
  assert.equal(recovered.ok, true);
  await releasePublishLock(staging, artwork.id, {
    holderId: recovered.holderId,
    epoch: recovered.epoch,
  });
});

test('expired lock recovery creates a successor epoch', async () => {
  const artwork = matchingArtwork();
  const staging = createStagingStorage();
  const stale = await acquirePublishLock(staging, artwork.id, {
    now: 1_000,
    ttlMs: 10,
    holderId: '55555555-5555-4555-8555-555555555555',
  });
  assert.equal(stale.ok, true);
  assert.equal(stale.epoch, 1);
  const recovered = await acquirePublishLock(staging, artwork.id, {
    now: 2_000,
    ttlMs: 90_000,
    holderId: '66666666-6666-4666-8666-666666666666',
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.acquired, 'recovered');
  assert.equal(recovered.epoch, 2);
  assert.equal(recovered.holderId, '66666666-6666-4666-8666-666666666666');
  assert.equal(staging.objects.has(publishLockEpochPath(artwork.id, 1)), true);
  assert.equal(staging.objects.has(publishLockEpochPath(artwork.id, 2)), true);
  const lock = JSON.parse(staging.objects.get(publishLockEpochPath(artwork.id, 2)).body.toString('utf8'));
  assert.equal(lock.holderId, '66666666-6666-4666-8666-666666666666');
  assert.equal(lock.epoch, 2);
});

test('old holder cannot delete a successor epoch lock', async () => {
  const artwork = matchingArtwork();
  const staging = createStagingStorage();
  const stale = await acquirePublishLock(staging, artwork.id, {
    now: 1_000,
    ttlMs: 10,
    holderId: '55555555-5555-4555-8555-555555555555',
  });
  const successor = await acquirePublishLock(staging, artwork.id, {
    now: 2_000,
    ttlMs: 90_000,
    holderId: '66666666-6666-4666-8666-666666666666',
  });
  assert.equal(successor.epoch, 2);
  const released = await releasePublishLock(staging, artwork.id, {
    holderId: stale.holderId,
    epoch: stale.epoch,
  });
  assert.equal(released.released, true);
  assert.equal(staging.objects.has(publishLockEpochPath(artwork.id, 1)), false);
  assert.equal(staging.objects.has(publishLockEpochPath(artwork.id, 2)), true);
  const mismatched = await releasePublishLock(staging, artwork.id, {
    holderId: stale.holderId,
    epoch: successor.epoch,
  });
  assert.equal(mismatched.released, false);
  assert.equal(staging.objects.has(publishLockEpochPath(artwork.id, 2)), true);
});

test('stale holder fails the fencing check and does not write current.json', async () => {
  const artwork = matchingArtwork();
  const firstJpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const secondJpeg = await makeJpeg(200, 150, { r: 12, g: 80, b: 200 });
  const firstGenerated = await generateMatching(artwork, firstJpeg);
  const secondGenerated = await generateMatching(artwork, secondJpeg);
  const publishing = createPublishStorage();
  const staging = createStagingStorage();
  await publishArAssetVersion({
    artwork,
    generated: firstGenerated,
    storage: publishing,
    logger: silentLogger,
  });
  const stale = await acquirePublishLock(staging, artwork.id, {
    now: 1_000,
    ttlMs: 10,
    holderId: '55555555-5555-4555-8555-555555555555',
  });
  const successor = await acquirePublishLock(staging, artwork.id, {
    now: 2_000,
    ttlMs: 90_000,
    holderId: '66666666-6666-4666-8666-666666666666',
  });
  const fence = await assertPublishFence(staging, artwork.id, {
    epoch: stale.epoch,
    holderId: stale.holderId,
    now: 2_000,
  });
  assert.equal(fence.ok, false);
  assert.equal(fence.reason, 'stale-fence');
  const liveFence = await assertPublishFence(staging, artwork.id, {
    epoch: successor.epoch,
    holderId: successor.holderId,
    now: 2_000,
  });
  assert.equal(liveFence.ok, true);
  const failed = await publishArAssetVersion({
    artwork,
    generated: secondGenerated,
    storage: publishing,
    logger: silentLogger,
    expectedContentHash: firstGenerated.manifest.contentHash,
    assertFence: () => assertPublishFence(staging, artwork.id, {
      epoch: stale.epoch,
      holderId: stale.holderId,
      now: 2_000,
    }),
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'stale-fence');
  assert.equal(currentHash(publishing, artwork.id), firstGenerated.manifest.contentHash);
});

test('successful publish deletes only the exact staged generation', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const [first, second] = await Promise.all([
    stageGeneratedArAssets({ artworkId: artwork.id, generated, storage: staging }),
    stageGeneratedArAssets({ artworkId: artwork.id, generated, storage: staging }),
  ]);
  const published = await publishStagedArAssets({
    artwork,
    generationId: first.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  assert.equal(published.ok, true);
  assert.equal(stagingHas(staging, artwork.id, first.contentHash, first.attemptId), false);
  assert.equal(stagingHas(staging, artwork.id, second.contentHash, second.attemptId), true);
});

test('stale compare-and-swap leaves the previous current.json intact', async () => {
  const artwork = matchingArtwork();
  const firstJpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const secondJpeg = await makeJpeg(200, 150, { r: 12, g: 80, b: 200 });
  const firstGenerated = await generateMatching(artwork, firstJpeg);
  const secondGenerated = await generateMatching(artwork, secondJpeg);
  const publishing = createPublishStorage();
  const first = await publishArAssetVersion({
    artwork,
    generated: firstGenerated,
    storage: publishing,
    logger: silentLogger,
  });
  assert.equal(first.ok, true);
  const failed = await publishArAssetVersion({
    artwork,
    generated: secondGenerated,
    storage: publishing,
    logger: silentLogger,
    expectedContentHash: null,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'stale-current');
  assert.equal(currentHash(publishing, artwork.id), firstGenerated.manifest.contentHash);
});

test('Admin and CLI use the same epoch lock protocol', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated,
    storage: staging,
  });
  const cliLock = await acquirePublishLock(staging, artwork.id, {
    holderId: '77777777-7777-4777-8777-777777777777',
  });
  assert.equal(cliLock.ok, true);
  const admin = await publishStagedArAssets({
    artwork,
    generationId: staged.generationId,
    stagingStorage: staging,
    publishStorage: publishing,
    sourceImageBuffer: jpeg,
    logger: silentLogger,
  });
  assert.equal(admin.ok, false);
  assert.equal(admin.reason, 'lock-held');
  assert.equal(publishing.objects.has(currentPointerPath(artwork.id)), false);
  await releasePublishLock(staging, artwork.id, {
    holderId: cliLock.holderId,
    epoch: cliLock.epoch,
  });
  const published = await publishCoordinatedArAssets({
    artwork,
    generated,
    publishStorage: publishing,
    lockStorage: staging,
    logger: silentLogger,
  });
  assert.equal(published.ok, true);
  assert.equal(currentHash(publishing, artwork.id), generated.manifest.contentHash);
  assert.equal(lockKeys(staging, artwork.id).length, 0);
});

test('concurrent Admin and CLI publishing serializes current.json', async () => {
  const artwork = matchingArtwork();
  const firstJpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const secondJpeg = await makeJpeg(200, 150, { r: 12, g: 80, b: 200 });
  const firstGenerated = await generateMatching(artwork, firstJpeg);
  const secondGenerated = await generateMatching(artwork, secondJpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  const staged = await stageGeneratedArAssets({
    artworkId: artwork.id,
    generated: firstGenerated,
    storage: staging,
  });
  const [admin, cli] = await Promise.all([
    publishStagedArAssets({
      artwork,
      generationId: staged.generationId,
      stagingStorage: staging,
      publishStorage: publishing,
      sourceImageBuffer: firstJpeg,
      logger: silentLogger,
    }),
    publishCoordinatedArAssets({
      artwork,
      generated: secondGenerated,
      publishStorage: publishing,
      lockStorage: staging,
      logger: silentLogger,
    }),
  ]);
  const results = [admin, cli];
  const winners = results.filter((result) => result.ok);
  const losers = results.filter((result) => !result.ok);
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.ok(['lock-held', 'stale-current', 'stale-fence'].includes(losers[0].reason));
  assert.ok([
    firstGenerated.manifest.contentHash,
    secondGenerated.manifest.contentHash,
  ].includes(currentHash(publishing, artwork.id)));
});

test('first current.json create-if-not-exists conflict is stale-current', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const inner = createPublishStorage();
  const publishing = wrapStorage(inner, {
    async upload(args) {
      if (String(args.objectPath) === currentPointerPath(artwork.id) && args.upsert !== true) {
        const error = new Error('Object already exists');
        error.status = 409;
        error.code = 'already-exists';
        throw error;
      }
      return inner.upload(args);
    },
  });
  const failed = await publishArAssetVersion({
    artwork,
    generated,
    storage: publishing,
    logger: silentLogger,
    expectedContentHash: null,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'stale-current');
  assert.equal(inner.objects.has(currentPointerPath(artwork.id)), false);
});

test('coordinated CLI publish refuses a stale snapshot', async () => {
  const artwork = matchingArtwork();
  const firstJpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const secondJpeg = await makeJpeg(200, 150, { r: 12, g: 80, b: 200 });
  const firstGenerated = await generateMatching(artwork, firstJpeg);
  const secondGenerated = await generateMatching(artwork, secondJpeg);
  const staging = createStagingStorage();
  const publishing = createPublishStorage();
  await publishArAssetVersion({
    artwork,
    generated: firstGenerated,
    storage: publishing,
    logger: silentLogger,
  });
  const failed = await publishCoordinatedArAssets({
    artwork,
    generated: secondGenerated,
    publishStorage: publishing,
    lockStorage: staging,
    logger: silentLogger,
    expectedContentHash: null,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'stale-current');
  assert.equal(currentHash(publishing, artwork.id), firstGenerated.manifest.contentHash);
});
