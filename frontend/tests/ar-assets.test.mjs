import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { ASPECT_MATCH_MAX_DELTA_PCT } from '../lib/ar-assets/constants.js';
import { compareAspect, imagePixelSize } from '../lib/ar-assets/aspect.js';
import { evaluateArReadiness, isArReady, statusBlockReason } from '../lib/ar-assets/eligibility.js';
import { generateArAssets } from '../lib/ar-assets/generate.js';
import { contentHash } from '../lib/ar-assets/hash.js';
import { resolveCurrentArAssets, verifyVersionOutputs, writeArAssetBundle } from '../lib/ar-assets/persist.js';
import { formatPhysicalLabel, parsePhysicalDimensions } from '../lib/ar-assets/physical.js';
import { containTextureSize, optimiseTexture } from '../lib/ar-assets/texture.js';
import { glbPlaneMetres } from '../lib/ar-assets/validate.js';

function stubJpeg(width, height) {
  const buffer = Buffer.alloc(12);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xc0;
  buffer.writeUInt16BE(8, 4);
  buffer[6] = 8;
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  return buffer;
}

async function makeJpeg(width, height, { quality = 90, r = 160, g = 120, b = 90 } = {}) {
  return sharp({
    create: { width, height, channels: 3, background: { r, g, b } },
  }).jpeg({ quality }).toBuffer();
}

test('admin physical dimensions convert to metres and never infer unit', () => {
  const physical = parsePhysicalDimensions({
    width: 200,
    height: 150,
    unit: 'cm',
  });
  assert.equal(physical.ok, true);
  assert.equal(physical.widthM, 2);
  assert.equal(physical.heightM, 1.5);
  assert.equal(physical.physicalAspect, 200 / 150);
  assert.equal(formatPhysicalLabel(physical), '200 × 150 cm');
  assert.equal(parsePhysicalDimensions({ width: 90, height: 120 }).ok, false);
  assert.ok(parsePhysicalDimensions({ width: 90, height: 120 }).reasons.includes('missing-unit'));
});

test('90 × 120 cm with 6720 × 10000 px is a material aspect mismatch', () => {
  const physical = parsePhysicalDimensions({ width: 90, height: 120, unit: 'cm' });
  const aspect = compareAspect({
    physicalAspect: physical.physicalAspect,
    pixelWidth: 6720,
    pixelHeight: 10000,
  });
  assert.equal(physical.widthM, 0.9);
  assert.equal(physical.heightM, 1.2);
  assert.equal(Number(aspect.imageAspect.toFixed(3)), 0.672);
  assert.ok(aspect.deltaPct > 10);
  assert.equal(aspect.matches, false);
  assert.ok(aspect.deltaPct > ASPECT_MATCH_MAX_DELTA_PCT);
});

test('matching image aspect allows generation at exact admin metres', async () => {
  const jpeg = await makeJpeg(200, 150);
  const result = await generateArAssets({
    artworkId: 'match-200-150',
    status: 'published',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: jpeg,
    title: 'Matching fixture',
  });
  assert.equal(result.generated, true);
  assert.equal(result.assetsValid, true);
  assert.equal(result.ready, true);
  assert.equal(result.physical.widthM, 2);
  assert.equal(result.physical.heightM, 1.5);
  assert.equal(result.manifest.stretched, false);
  assert.equal(result.manifest.cropped, false);
  assert.deepEqual(result.plane, { widthM: 2, heightM: 1.5 });
  assert.deepEqual(glbPlaneMetres(result.files.glb), { widthM: 2, heightM: 1.5 });
  assert.equal(result.manifest.texture.optimised, true);
});

test('mismatched 90 × 120 artwork is flagged and does not generate meshes', async () => {
  const jpeg = stubJpeg(6720, 10000);
  const result = await generateArAssets({
    artworkId: '506b0baa-f6e2-4d19-9922-7979b314fa69',
    status: 'published',
    width: 90,
    height: 120,
    depth: 4,
    unit: 'cm',
    imageBuffer: jpeg,
    title: 'A Moment of Innocence',
  });
  assert.equal(result.generated, false);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes('aspect-mismatch'));
  assert.equal(result.files, null);
  assert.equal(result.physical.widthM, 0.9);
  assert.equal(result.physical.heightM, 1.2);
  assert.equal(result.manifest.ready, false);
  assert.equal(result.manifest.assetsValid, false);
  assert.equal(result.physicalLabel, '90 × 120 × 4 cm');
  assert.match(result.manifest.customerCopy, /90 × 120 × 4 cm/);
});

test('eligibility refuses unresolved aspect mismatch even when published', async () => {
  const jpeg = stubJpeg(6720, 10000);
  const generated = await generateArAssets({
    artworkId: 'golden',
    status: 'published',
    width: 90,
    height: 120,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  const eligibility = evaluateArReadiness({
    artwork: { status: 'published', width: 90, height: 120, dimensionUnit: 'cm' },
    imageBuffer: jpeg,
    manifest: generated.manifest,
    assetsPresent: generated.generated,
  });
  assert.equal(isArReady({
    artwork: { status: 'published', width: 90, height: 120, dimensionUnit: 'cm' },
    imageBuffer: jpeg,
    manifest: generated.manifest,
    assetsPresent: false,
  }), false);
  assert.ok(eligibility.reasons.includes('aspect-mismatch'));
});

test('published matching artwork with written meshes is AR-ready', async () => {
  const jpeg = await makeJpeg(200, 150);
  const generated = await generateArAssets({
    artworkId: 'ready-200-150',
    status: 'published',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  assert.equal(isArReady({
    artwork: {
      status: 'published',
      width: 200,
      height: 150,
      dimensionUnit: 'cm',
      expectedHash: generated.manifest.contentHash,
    },
    imageBuffer: jpeg,
    manifest: generated.manifest,
    assetsPresent: true,
  }), true);
});

test('sold matching artwork remains AR-preview eligible', async () => {
  const jpeg = await makeJpeg(200, 150);
  const result = await generateArAssets({
    artworkId: 'sold-match',
    status: 'sold',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  assert.equal(result.generated, true);
  assert.equal(result.ready, true);
  assert.equal(statusBlockReason('sold'), null);
  assert.equal(isArReady({
    artwork: {
      status: 'sold',
      width: 200,
      height: 150,
      dimensionUnit: 'cm',
      expectedHash: result.manifest.contentHash,
    },
    imageBuffer: jpeg,
    manifest: result.manifest,
    assetsPresent: true,
  }), true);
});

test('reserved matching artwork is never AR-ready', async () => {
  const jpeg = await makeJpeg(200, 150);
  const result = await generateArAssets({
    artworkId: 'reserved-match',
    status: 'reserved',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  assert.equal(result.generated, true);
  assert.equal(result.assetsValid, true);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes('reserved'));
  assert.equal(statusBlockReason('reserved'), 'reserved');
  assert.equal(isArReady({
    artwork: {
      status: 'reserved',
      width: 200,
      height: 150,
      dimensionUnit: 'cm',
      expectedHash: result.manifest.contentHash,
    },
    imageBuffer: jpeg,
    manifest: result.manifest,
    assetsPresent: true,
  }), false);
});

test('draft matching artwork can generate meshes but is not AR-ready', async () => {
  const jpeg = await makeJpeg(90, 120);
  const result = await generateArAssets({
    artworkId: 'draft-match',
    status: 'draft',
    width: 90,
    height: 120,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  assert.equal(result.generated, true);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes('not-published'));
});

test('texture contain preserves aspect and does not stretch', () => {
  const size = containTextureSize(6720, 10000, 2048);
  assert.equal(size.downscaled, true);
  assert.equal(size.height, 2048);
  assert.equal(size.width, Math.round(6720 * (2048 / 10000)));
  assert.equal(Number((size.width / size.height).toFixed(3)), Number((6720 / 10000).toFixed(3)));
  const small = containTextureSize(800, 600, 2048);
  assert.equal(small.downscaled, false);
  assert.equal(small.width, 800);
});

test('optimiseTexture decodes, resizes and reduces JPEG bytes', async () => {
  const source = await makeJpeg(3200, 2400, { quality: 95 });
  const processed = await optimiseTexture(source, { maxEdge: 1024, quality: 82 });
  assert.equal(processed.downscaled, true);
  assert.equal(processed.width, 1024);
  assert.equal(processed.height, 768);
  assert.ok(processed.embeddedBytes < source.length);
  assert.equal(processed.reduced, true);
  assert.equal(Number((processed.width / processed.height).toFixed(3)), Number((3200 / 2400).toFixed(3)));
});

test('GLB and USDZ embed the processed texture, not the oversized original', async () => {
  const source = await makeJpeg(3200, 2400, { quality: 95 });
  const full = await generateArAssets({
    artworkId: 'tex-full',
    status: 'published',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: source,
    textureMaxEdge: 4096,
  });
  const small = await generateArAssets({
    artworkId: 'tex-small',
    status: 'published',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: source,
    textureMaxEdge: 1024,
  });
  assert.equal(full.plane.widthM, 2);
  assert.equal(small.plane.widthM, 2);
  assert.ok(small.files.texture.length < source.length);
  assert.ok(small.files.glb.length < full.files.glb.length);
  assert.ok(small.files.usdz.length < full.files.usdz.length);
  assert.equal(small.manifest.texture.optimised, true);
});

test('content hash changes when source image or physical width changes, not when only status changes', async () => {
  const jpeg = await makeJpeg(90, 120);
  const other = await makeJpeg(90, 120, { r: 10, g: 20, b: 30 });
  const base = {
    imageBuffer: jpeg,
    width: 90,
    height: 120,
    unit: 'cm',
  };
  const same = contentHash(base);
  assert.equal(contentHash({ ...base, status: 'draft' }), same);
  assert.notEqual(contentHash({ ...base, width: 91 }), same);
  assert.notEqual(contentHash({ ...base, imageBuffer: other }), same);
});

test('undecodable matching SOF stub fails generation and is not marked ready', async () => {
  const jpeg = stubJpeg(200, 150);
  const result = await generateArAssets({
    artworkId: 'bad-jpeg',
    status: 'published',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  assert.equal(result.generated, false);
  assert.equal(result.assetsValid, false);
  assert.equal(result.ready, false);
  assert.equal(result.files, null);
  assert.ok(result.reasons.includes('generation-failed'));
});

test('persisted mismatch bundle writes current.json not-ready and does not serve old models', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-assets-'));
  const matching = await makeJpeg(200, 150);
  const ready = await generateArAssets({
    artworkId: 'tmp-version',
    status: 'published',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: matching,
  });
  writeArAssetBundle(ready, dir);
  const first = resolveCurrentArAssets(dir, {
    expectedHash: ready.manifest.contentHash,
    physical: ready.physical,
  });
  assert.equal(first.ready, true);
  assert.equal(first.assetsValid, true);
  assert.ok(first.glbPath.endsWith('painting.glb'));
  assert.ok(first.usdzPath.endsWith('painting.usdz'));
  assert.equal(path.basename(path.dirname(first.glbPath)), ready.manifest.contentHash);

  const mismatch = await generateArAssets({
    artworkId: 'tmp-version',
    status: 'published',
    width: 90,
    height: 120,
    unit: 'cm',
    imageBuffer: stubJpeg(6720, 10000),
  });
  writeArAssetBundle(mismatch, dir);
  const current = JSON.parse(fs.readFileSync(path.join(dir, 'current.json'), 'utf8'));
  assert.equal(current.ready, false);
  assert.equal(current.assetsValid, false);
  assert.equal(current.files.glb, null);
  assert.equal(current.files.usdz, null);
  const resolved = resolveCurrentArAssets(dir, {
    expectedHash: mismatch.manifest.contentHash,
    physical: mismatch.physical,
  });
  assert.equal(resolved.ready, false);
  assert.equal(resolved.assetsValid, false);
  assert.equal(resolved.glbPath, null);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.ready, false);
  assert.ok(manifest.reasons.includes('aspect-mismatch'));
  assert.equal(fs.existsSync(path.join(dir, 'painting.glb')), false);
});

test('changing physical width writes a new version directory and updates current.json', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-assets-'));
  const jpeg = await makeJpeg(200, 150);
  const first = await generateArAssets({
    artworkId: 'resize',
    status: 'published',
    width: 200,
    height: 150,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  writeArAssetBundle(first, dir);
  const second = await generateArAssets({
    artworkId: 'resize',
    status: 'published',
    width: 180,
    height: 135,
    unit: 'cm',
    imageBuffer: jpeg,
  });
  writeArAssetBundle(second, dir);
  assert.notEqual(first.manifest.contentHash, second.manifest.contentHash);
  const current = JSON.parse(fs.readFileSync(path.join(dir, 'current.json'), 'utf8'));
  assert.equal(current.contentHash, second.manifest.contentHash);
  assert.equal(current.versionDir, second.manifest.contentHash);
  assert.equal(current.files.glb, `${second.manifest.contentHash}/painting.glb`);
  assert.equal(current.files.usdz, `${second.manifest.contentHash}/painting.usdz`);
  const plane = glbPlaneMetres(fs.readFileSync(path.join(dir, current.files.glb)));
  assert.deepEqual(plane, { widthM: 1.8, heightM: 1.35 });
  const stale = resolveCurrentArAssets(dir, {
    expectedHash: first.manifest.contentHash,
    physical: first.physical,
  });
  assert.ok(stale.reasons.includes('stale-hash'));
  assert.equal(stale.ready, false);
});

test('incomplete version directory is not treated as current even if current.json claims ready', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-assets-'));
  const versionDir = path.join(dir, 'deadbeef');
  fs.mkdirSync(versionDir, { recursive: true });
  fs.writeFileSync(path.join(versionDir, 'painting.glb'), Buffer.from('partial'));
  fs.writeFileSync(path.join(dir, 'current.json'), `${JSON.stringify({
    contentHash: 'deadbeef',
    ready: true,
    assetsValid: true,
    versionDir: 'deadbeef',
    files: {
      glb: 'deadbeef/painting.glb',
      usdz: 'deadbeef/painting.usdz',
    },
  }, null, 2)}\n`);
  const resolved = resolveCurrentArAssets(dir, {
    expectedHash: 'deadbeef',
    physical: { widthM: 2, heightM: 1.5 },
  });
  assert.equal(resolved.ready, false);
  assert.equal(resolved.assetsValid, false);
  assert.ok(resolved.reasons.includes('missing-assets') || resolved.reasons.includes('invalid-assets'));
  const verified = verifyVersionOutputs(versionDir, { widthM: 2, heightM: 1.5 });
  assert.equal(verified.ok, false);
});

test('JPEG pixel size is read for validation', () => {
  assert.deepEqual(imagePixelSize(stubJpeg(6720, 10000)), { width: 6720, height: 10000 });
});
