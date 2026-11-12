import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generateArAssets } from '../lib/ar-assets/generate.js';
import { writeArAssetBundle } from '../lib/ar-assets/persist.js';
import { resolveArtworkArAssets } from '../lib/ar-assets/storefront-fs.js';
import {
  catalogueMatchesManifest,
  evaluateStorefrontAr,
  previewAspectRatio,
  publicArAssetUrl,
  serializeStorefrontAr,
  shouldMountModelViewer,
  shouldShowViewOnWall,
  SIZE_GUIDE_REFERENCES,
  sizeGuideArtworkCm,
  sizeGuideLayout,
} from '../lib/ar-assets/storefront.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN_ID = '506b0baa-f6e2-4d19-9922-7979b314fa69';
const ASSET_ORIGIN = 'https://example.supabase.co/storage/v1/object/public/ar-assets';

async function makeJpeg(width, height) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 160, g: 120, b: 90 } },
  }).jpeg({ quality: 90 }).toBuffer();
}

function matchingArtwork(overrides = {}) {
  return {
    id: '20015000-0000-4000-8000-000000000001',
    status: 'published',
    width: 200,
    height: 150,
    dimensionUnit: 'cm',
    images: [{ id: 'img-1', storagePath: 'lot/one.jpg' }],
    ...overrides,
  };
}

test('preview frames use admin aspect and never stretch to 4:5', () => {
  const physical = previewAspectRatio({ width: 200, height: 150, dimensionUnit: 'cm' });
  assert.equal(physical.source, 'admin');
  assert.equal(physical.width / physical.height, 200 / 150);
  const fallback = previewAspectRatio({ width: 90, height: 120 });
  assert.equal(fallback.source, 'fallback');
  assert.equal(fallback.width / fallback.height, 4 / 5);
});

test('size guide uses stated reference centimetres and keeps artwork aspect', () => {
  assert.equal(SIZE_GUIDE_REFERENCES.sofa.widthCm, 220);
  assert.equal(SIZE_GUIDE_REFERENCES.bed.widthCm, 160);
  assert.equal(SIZE_GUIDE_REFERENCES.wall.widthCm, 400);
  const artworkCm = sizeGuideArtworkCm({ width: 200, height: 150, dimensionUnit: 'cm' });
  assert.equal(artworkCm.widthCm, 200);
  assert.equal(artworkCm.heightCm, 150);
  const layout = sizeGuideLayout(artworkCm, SIZE_GUIDE_REFERENCES.sofa);
  assert.equal(Number(layout.artwork.aspect.toFixed(3)), Number((200 / 150).toFixed(3)));
  assert.equal(layout.reference.aspect, 220 / 85);
});

test('View on your wall requires both storefront readiness and canActivateAR', () => {
  assert.equal(shouldShowViewOnWall(true, true), true);
  assert.equal(shouldShowViewOnWall(true, false), false);
  assert.equal(shouldShowViewOnWall(false, true), false);
  assert.equal(shouldMountModelViewer(true, '/ar-assets/a/b/painting.glb', '/ar-assets/a/b/painting.usdz'), true);
  assert.equal(shouldMountModelViewer(true, '/ar-assets/a/b/painting.glb', null), false);
  assert.equal(shouldMountModelViewer(false, '/x.glb', '/x.usdz'), false);
});

test('published matching assets with current.json are storefront AR-ready', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-storefront-'));
  const artwork = matchingArtwork();
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateArAssets({
    artworkId: artwork.id,
    status: 'published',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  writeArAssetBundle(generated, path.join(dir, artwork.id));
  const ar = resolveArtworkArAssets(artwork, { assetsRoot: dir, assetOrigin: ASSET_ORIGIN });
  assert.equal(ar.ready, true);
  assert.equal(ar.widthM, 2);
  assert.equal(ar.heightM, 1.5);
  assert.equal(ar.glbUrl, `${ASSET_ORIGIN}/${artwork.id}/${generated.manifest.contentHash}/painting.glb`);
  assert.equal(ar.usdzUrl, `${ASSET_ORIGIN}/${artwork.id}/${generated.manifest.contentHash}/painting.usdz`);
  assert.ok(catalogueMatchesManifest(artwork, generated.manifest));
});

test('sold matching artwork remains storefront AR-ready', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-storefront-'));
  const artwork = matchingArtwork({ status: 'sold' });
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateArAssets({
    artworkId: artwork.id,
    status: 'sold',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  writeArAssetBundle(generated, path.join(dir, artwork.id));
  const ar = resolveArtworkArAssets(artwork, { assetsRoot: dir, assetOrigin: ASSET_ORIGIN });
  assert.equal(ar.ready, true);
  assert.equal(ar.glbUrl.includes('painting.glb'), true);
});

test('reserved, draft and archived matching artworks do not get AR URLs', async () => {
  const jpeg = await makeJpeg(200, 150);
  for (const status of ['reserved', 'draft', 'archived']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-storefront-'));
    const artwork = matchingArtwork({ status });
    const generated = await generateArAssets({
      artworkId: artwork.id,
      status,
      width: 200,
      height: 150,
      unit: 'cm',
      imageBuffer: jpeg,
    });
    writeArAssetBundle(generated, path.join(dir, artwork.id));
    const ar = resolveArtworkArAssets(artwork, { assetsRoot: dir, assetOrigin: ASSET_ORIGIN });
    assert.equal(ar.ready, false, status);
    assert.equal(ar.glbUrl, null, status);
    assert.equal(ar.usdzUrl, null, status);
  }
});

test('missing current.json, missing pair and stale catalogue dimensions hide the CTA', async () => {
  const missing = evaluateStorefrontAr({
    artwork: matchingArtwork(),
    current: null,
    manifest: null,
    assetsPresent: false,
    imageAvailable: true,
  });
  assert.equal(missing.ready, false);
  assert.ok(missing.reasons.includes('missing-current') || missing.reasons.includes('missing-manifest'));

  const jpeg = await makeJpeg(200, 150);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-storefront-'));
  const artwork = matchingArtwork();
  const generated = await generateArAssets({
    artworkId: artwork.id,
    status: 'published',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  writeArAssetBundle(generated, path.join(dir, artwork.id));
  fs.unlinkSync(path.join(dir, artwork.id, generated.manifest.contentHash, 'painting.usdz'));
  const incomplete = resolveArtworkArAssets(artwork, { assetsRoot: dir, assetOrigin: ASSET_ORIGIN });
  assert.equal(incomplete.ready, false);
  assert.equal(incomplete.glbUrl, null);

  const stale = resolveArtworkArAssets(matchingArtwork({ width: 180, height: 135 }), {
    assetsRoot: dir,
    assetOrigin: ASSET_ORIGIN,
  });
  assert.equal(stale.ready, false);
  assert.ok(stale.reasons.includes('stale-hash'));
  assert.equal(stale.glbUrl, null);
});

test('serializeStorefrontAr never returns model URLs unless ready', () => {
  const serialized = serializeStorefrontAr({
    ready: false,
    reasons: ['aspect-mismatch'],
    physical: { widthM: 0.9, heightM: 1.2 },
    physicalLabel: '90 × 120 cm',
  }, {
    artworkId: GOLDEN_ID,
    current: {
      contentHash: 'abc',
      files: { glb: 'abc/painting.glb', usdz: 'abc/painting.usdz' },
    },
    glbPresent: true,
    usdzPresent: true,
  });
  assert.equal(serialized.ready, false);
  assert.equal(serialized.glbUrl, null);
  assert.equal(serialized.usdzUrl, null);
  assert.equal(publicArAssetUrl(GOLDEN_ID, 'abc/painting.glb'), null);
  assert.equal(
    publicArAssetUrl(GOLDEN_ID, 'abc/painting.glb', ASSET_ORIGIN),
    `${ASSET_ORIGIN}/${GOLDEN_ID}/abc/painting.glb`,
  );
});

test('golden mismatched artwork on disk is not a production AR-ready example', () => {
  const ar = resolveArtworkArAssets({
    id: GOLDEN_ID,
    status: 'published',
    width: 90,
    height: 120,
    depth: 4,
    dimensionUnit: 'cm',
    images: [{ id: 'img' }],
  }, { assetsRoot: path.join(frontendRoot, 'public', 'ar-assets') });
  assert.equal(ar.ready, false);
  assert.equal(ar.glbUrl, null);
  assert.equal(ar.usdzUrl, null);
  assert.ok(ar.reasons.includes('aspect-mismatch') || ar.reasons.includes('generation-not-ready'));
});
