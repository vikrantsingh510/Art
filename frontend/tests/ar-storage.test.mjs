import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { generateArAssets } from '../lib/ar-assets/generate.js';
import { sha256Hex } from '../lib/ar-assets/hash.js';
import { activateArtworkAr, arLaunchFailureCopy, AR_LAUNCH_FAILED_COPY } from '../lib/ar-assets/launch.js';
import { publishArAssetVersion } from '../lib/ar-assets/publish.js';
import { ArStorageError, createMemoryArStorage, createSupabaseArStorage } from '../lib/ar-assets/storage-client.js';
import { currentPointerPath, versionGlbPath, versionManifestPath, versionUsdzPath } from '../lib/ar-assets/storage-paths.js';
import { resolveArtworkArAssets } from '../lib/ar-assets/storefront-storage.js';

const silentLogger = { error() {}, info() {}, warn() {} };
const ASSET_ORIGIN = 'https://example.supabase.co/storage/v1/object/public/ar-assets';

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

function publicFetchFromStorage(storage, { artworkId, requested = null } = {}) {
  const prefix = `${ASSET_ORIGIN}/`;
  return async (url) => {
    const href = String(url);
    requested?.push(href);
    if (!href.startsWith(prefix)) {
      return new Response(JSON.stringify({ message: 'Object not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const objectPath = decodeURIComponent(href.slice(prefix.length));
    if (artworkId && !objectPath.startsWith(`${artworkId}/`)) {
      return new Response(JSON.stringify({ message: 'Object not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const row = storage.objects.get(objectPath);
    if (!row) {
      return new Response(JSON.stringify({ message: 'Object not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(row.body, {
      status: 200,
      headers: {
        'Content-Type': row.contentType,
        'Content-Length': String(row.body.length),
      },
    });
  };
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

test('successful GLB and USDZ publish then remote storefront resolution', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const storage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  const published = await publishArAssetVersion({
    artwork,
    generated,
    storage,
    logger: silentLogger,
  });
  assert.equal(published.ok, true);
  assert.equal(published.published, true);
  assert.equal(published.previousCurrent, null);
  assert.ok(storage.objects.has(`${artwork.id}/${generated.manifest.contentHash}/painting.glb`));
  assert.ok(storage.objects.has(`${artwork.id}/${generated.manifest.contentHash}/painting.usdz`));
  assert.ok(storage.objects.has(`${artwork.id}/current.json`));

  const ar = await resolveArtworkArAssets(artwork, {
    storage,
    origin: ASSET_ORIGIN,
    sourceImageBuffer: jpeg,
  });
  assert.equal(ar.ready, true);
  assert.equal(ar.glbUrl, `${ASSET_ORIGIN}/${artwork.id}/${generated.manifest.contentHash}/painting.glb`);
  assert.equal(ar.usdzUrl, `${ASSET_ORIGIN}/${artwork.id}/${generated.manifest.contentHash}/painting.usdz`);
});

test('public storefront URLs prefix artwork id on current, manifest, glb and usdz', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const storage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  const published = await publishArAssetVersion({
    artwork,
    generated,
    storage,
    logger: silentLogger,
  });
  assert.equal(published.ok, true);

  const requested = [];
  const hash = generated.manifest.contentHash;
  const ar = await resolveArtworkArAssets(artwork, {
    origin: ASSET_ORIGIN,
    fetchImpl: publicFetchFromStorage(storage, { artworkId: artwork.id, requested }),
    sourceImageBuffer: jpeg,
  });

  assert.equal(ar.ready, true);
  assert.equal(ar.contentHash, hash);
  assert.equal(ar.glbUrl, `${ASSET_ORIGIN}/${artwork.id}/${hash}/painting.glb`);
  assert.equal(ar.usdzUrl, `${ASSET_ORIGIN}/${artwork.id}/${hash}/painting.usdz`);

  const unprefixedManifest = `${ASSET_ORIGIN}/${hash}/manifest.json`;
  assert.equal(requested.includes(unprefixedManifest), false);
  assert.ok(requested.includes(`${ASSET_ORIGIN}/${currentPointerPath(artwork.id)}`));
  assert.ok(requested.includes(`${ASSET_ORIGIN}/${versionManifestPath(artwork.id, hash)}`));
  assert.ok(requested.includes(`${ASSET_ORIGIN}/${versionGlbPath(artwork.id, hash)}`));
  assert.ok(requested.includes(`${ASSET_ORIGIN}/${versionUsdzPath(artwork.id, hash)}`));
});

test('failed public Storage requests hide AR URLs without throwing', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);

  const missing = await resolveArtworkArAssets(artwork, {
    origin: ASSET_ORIGIN,
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Object not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
    sourceImageBuffer: jpeg,
  });
  assert.equal(missing.ready, false);
  assert.equal(missing.glbUrl, null);
  assert.equal(missing.usdzUrl, null);

  const network = await resolveArtworkArAssets(artwork, {
    origin: ASSET_ORIGIN,
    fetchImpl: async () => {
      throw new Error('network down');
    },
    sourceImageBuffer: jpeg,
  });
  assert.equal(network.ready, false);
  assert.equal(network.glbUrl, null);
});

test('first publish treats Storage 400 Object not found as no previous current', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const inner = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  const storage = wrapStorage(inner, {
    async download(objectPath) {
      if (String(objectPath).endsWith('current.json') && !inner.objects.has(objectPath)) {
        throw new ArStorageError('Object not found', {
          status: 400,
          path: objectPath,
        });
      }
      return inner.download(objectPath);
    },
  });
  const published = await publishArAssetVersion({
    artwork,
    generated,
    storage,
    logger: silentLogger,
  });
  assert.equal(published.ok, true);
  assert.equal(published.published, true);
  assert.equal(published.previousCurrent, null);
  assert.ok(inner.objects.has(currentPointerPath(artwork.id)));
});

test('Supabase download maps HTTP 400 Object not found to a missing object', async () => {
  const storage = createSupabaseArStorage({
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'sb_secret_test',
    fetchImpl: async () => new Response(JSON.stringify({
      statusCode: '404',
      error: 'not_found',
      message: 'Object not found',
    }), { status: 400, headers: { 'Content-Type': 'application/json' } }),
  });
  await assert.rejects(
    () => storage.download('lot/current.json'),
    (error) => error instanceof ArStorageError && error.code === 'not-found' && error.status === 404,
  );
});

test('partial USDZ upload failure keeps the previous current version', async () => {
  const artwork = matchingArtwork();
  const firstJpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const secondJpeg = await makeJpeg(200, 150, { r: 40, g: 80, b: 180 });
  const first = await generateMatching(artwork, firstJpeg);
  const inner = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  const firstPublish = await publishArAssetVersion({
    artwork,
    generated: first,
    storage: inner,
    logger: silentLogger,
  });
  assert.equal(firstPublish.ok, true);

  const second = await generateMatching(artwork, secondJpeg);
  assert.notEqual(second.manifest.contentHash, first.manifest.contentHash);
  const storage = wrapStorage(inner, {
    async upload(args) {
      if (String(args.objectPath).endsWith('.usdz')) {
        throw new Error('USDZ upload failed');
      }
      return inner.upload(args);
    },
  });
  const failed = await publishArAssetVersion({
    artwork,
    generated: second,
    storage,
    logger: silentLogger,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.published, false);
  assert.equal(failed.step, 'upload-usdz');
  assert.equal(failed.current.contentHash, first.manifest.contentHash);
  const pointer = JSON.parse(inner.objects.get(currentPointerPath(artwork.id)).body.toString('utf8'));
  assert.equal(pointer.contentHash, first.manifest.contentHash);
  assert.equal(inner.objects.has(`${artwork.id}/${second.manifest.contentHash}/painting.usdz`), false);

  const ar = await resolveArtworkArAssets(artwork, {
    storage: inner,
    origin: ASSET_ORIGIN,
    sourceImageBuffer: firstJpeg,
  });
  assert.equal(ar.ready, true);
  assert.equal(ar.contentHash, first.manifest.contentHash);
});

test('failed manifest publication does not flip current', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const inner = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  const storage = wrapStorage(inner, {
    async upload(args) {
      if (String(args.objectPath).endsWith('manifest.json')) {
        throw new Error('manifest upload failed');
      }
      return inner.upload(args);
    },
  });
  const failed = await publishArAssetVersion({
    artwork,
    generated,
    storage,
    logger: silentLogger,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.step, 'upload-manifest');
  assert.equal(inner.objects.has(currentPointerPath(artwork.id)), false);
});

test('corrupt GLB is rejected before current is published', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  generated.files.glb = Buffer.from('this is not a glb file');
  generated.manifest.glbSha256 = sha256Hex(generated.files.glb);
  const storage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  const failed = await publishArAssetVersion({
    artwork,
    generated,
    storage,
    logger: silentLogger,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.step, 'validate-local');
  assert.equal(storage.objects.size, 0);
});

test('corrupt USDZ is rejected before current is published', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  generated.files.usdz = Buffer.from('PK\u0003\u0004not-a-painting-archive');
  generated.manifest.usdzSha256 = sha256Hex(generated.files.usdz);
  const storage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  const failed = await publishArAssetVersion({
    artwork,
    generated,
    storage,
    logger: silentLogger,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.step, 'validate-local');
  assert.equal(storage.objects.size, 0);
});

test('hash mismatch of uploaded GLB preserves the previous pointer', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const inner = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  const first = await publishArAssetVersion({
    artwork,
    generated,
    storage: inner,
    logger: silentLogger,
  });
  assert.equal(first.ok, true);

  const nextJpeg = await makeJpeg(200, 150, { r: 10, g: 20, b: 30 });
  const next = await generateMatching(artwork, nextJpeg);
  const storage = wrapStorage(inner, {
    async download(objectPath) {
      const buffer = await inner.download(objectPath);
      if (String(objectPath) === versionGlbPath(artwork.id, next.manifest.contentHash)) {
        const corrupted = Buffer.from(buffer);
        corrupted[20] = (corrupted[20] + 1) % 256;
        return corrupted;
      }
      return buffer;
    },
  });
  const failed = await publishArAssetVersion({
    artwork,
    generated: next,
    storage,
    logger: silentLogger,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.step, 'verify-upload');
  const pointer = JSON.parse(inner.objects.get(currentPointerPath(artwork.id)).body.toString('utf8'));
  assert.equal(pointer.contentHash, generated.manifest.contentHash);
});

test('changed source image hides remote AR URLs', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150, { r: 160, g: 120, b: 90 });
  const other = await makeJpeg(200, 150, { r: 12, g: 200, b: 40 });
  const generated = await generateMatching(artwork, jpeg);
  const storage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  await publishArAssetVersion({ artwork, generated, storage, logger: silentLogger });
  const ar = await resolveArtworkArAssets(artwork, {
    storage,
    origin: ASSET_ORIGIN,
    sourceImageBuffer: other,
  });
  assert.equal(ar.ready, false);
  assert.ok(ar.reasons.includes('stale-source-image'));
  assert.equal(ar.glbUrl, null);
});

test('changed physical dimensions hide remote AR URLs', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const storage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  await publishArAssetVersion({ artwork, generated, storage, logger: silentLogger });
  const ar = await resolveArtworkArAssets(matchingArtwork({ width: 180, height: 135 }), {
    storage,
    origin: ASSET_ORIGIN,
    sourceImageBuffer: jpeg,
  });
  assert.equal(ar.ready, false);
  assert.ok(ar.reasons.includes('stale-hash'));
  assert.equal(ar.glbUrl, null);
});

test('missing explicit unit is never inferred for remote AR', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const storage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  await publishArAssetVersion({ artwork, generated, storage, logger: silentLogger });
  const ar = await resolveArtworkArAssets(matchingArtwork({ dimensionUnit: undefined }), {
    storage,
    origin: ASSET_ORIGIN,
    sourceImageBuffer: jpeg,
  });
  assert.equal(ar.ready, false);
  assert.ok(ar.reasons.includes('missing-unit'));
  assert.equal(ar.glbUrl, null);
});

test('stale current pointer does not emit asset URLs', async () => {
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateMatching(artwork, jpeg);
  const storage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  await publishArAssetVersion({ artwork, generated, storage, logger: silentLogger });
  const stale = {
    artworkId: artwork.id,
    contentHash: 'deadbeef',
    ready: true,
    assetsValid: true,
    versionDir: 'deadbeef',
    files: {
      glb: 'deadbeef/painting.glb',
      usdz: 'deadbeef/painting.usdz',
      manifest: 'deadbeef/manifest.json',
    },
  };
  await storage.upload({
    objectPath: currentPointerPath(artwork.id),
    body: Buffer.from(`${JSON.stringify(stale)}\n`),
    contentType: 'application/json',
    upsert: true,
  });
  const ar = await resolveArtworkArAssets(artwork, {
    storage,
    origin: ASSET_ORIGIN,
    sourceImageBuffer: jpeg,
  });
  assert.equal(ar.ready, false);
  assert.equal(ar.glbUrl, null);
});

test('published and sold artworks can resolve; reserved draft and archived cannot publish', async () => {
  const jpeg = await makeJpeg(200, 150);
  const soldArtwork = matchingArtwork({ status: 'sold' });
  const sold = await generateMatching(soldArtwork, jpeg);
  const storage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
  const soldPublish = await publishArAssetVersion({
    artwork: soldArtwork,
    generated: sold,
    storage,
    logger: silentLogger,
  });
  assert.equal(soldPublish.ok, true);
  const soldAr = await resolveArtworkArAssets(soldArtwork, {
    storage,
    origin: ASSET_ORIGIN,
    sourceImageBuffer: jpeg,
  });
  assert.equal(soldAr.ready, true);

  for (const status of ['reserved', 'draft', 'archived']) {
    const blockedStorage = createMemoryArStorage({ publicOrigin: ASSET_ORIGIN });
    const artwork = matchingArtwork({ status });
    const generated = await generateMatching(artwork, jpeg);
    const published = await publishArAssetVersion({
      artwork,
      generated,
      storage: blockedStorage,
      logger: silentLogger,
    });
    assert.equal(published.ok, false, status);
    assert.equal(published.step, 'eligibility', status);
    assert.equal(blockedStorage.objects.size, 0, status);
    const ar = await resolveArtworkArAssets(artwork, {
      storage,
      origin: ASSET_ORIGIN,
      sourceImageBuffer: jpeg,
    });
    assert.equal(ar.ready, false, status);
    assert.equal(ar.glbUrl, null, status);
  }
});

test('AR launch handles synchronous exceptions and promise rejections', async () => {
  await assert.rejects(
    () => activateArtworkAr(null, { canActivateAR: true }),
    /not ready/,
  );
  await assert.rejects(
    () => activateArtworkAr({ activateAR() {} }, { canActivateAR: false }),
    /not available/,
  );

  const syncThrow = {
    activateAR() {
      throw new Error('WebXR session denied');
    },
  };
  await assert.rejects(() => activateArtworkAr(syncThrow, { canActivateAR: true }), /WebXR session denied/);

  const rejecting = {
    activateAR() {
      return Promise.reject(new Error('Quick Look failed'));
    },
  };
  await assert.rejects(() => activateArtworkAr(rejecting, { canActivateAR: true }), /Quick Look failed/);

  let activated = false;
  await activateArtworkAr({
    activateAR() {
      activated = true;
    },
  }, { canActivateAR: true });
  assert.equal(activated, true);

  assert.equal(arLaunchFailureCopy(null), AR_LAUNCH_FAILED_COPY);
  assert.match(arLaunchFailureCopy(new Error('boom')), /boom/);
});
