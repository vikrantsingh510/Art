import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  detectImageKind,
  inspectImageBytes,
  imageInspectionWarnings,
  LOW_RESOLUTION_MIN_EDGE,
} from '../lib/artwork-image-inspect.js';
import { validateArtworkImageFile, ARTWORK_IMAGES_BUCKET } from '../lib/artwork-image-constraints.js';

const constraints = {
  bucket: ARTWORK_IMAGES_BUCKET,
  fileSizeLimitBytes: 10_485_760,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
};

async function jpegBytes(width, height) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 12, g: 24, b: 36 } },
  }).jpeg({ quality: 80 }).toBuffer();
}

async function pngBytes(width, height) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 10, b: 10 } },
  }).png().toBuffer();
}

test('detects JPEG and PNG from file bytes, not the filename', async () => {
  const jpeg = await jpegBytes(80, 60);
  const png = await pngBytes(40, 30);
  assert.equal(detectImageKind(jpeg), 'jpeg');
  assert.equal(detectImageKind(png), 'png');
  const jpegInfo = inspectImageBytes(jpeg);
  assert.equal(jpegInfo.ok, true);
  assert.equal(jpegInfo.width, 80);
  assert.equal(jpegInfo.height, 60);
  const pngInfo = inspectImageBytes(png);
  assert.equal(pngInfo.ok, true);
  assert.equal(pngInfo.width, 40);
  assert.equal(pngInfo.height, 30);
});

test('rejects GIF and truncated JPEG as invalid images', () => {
  const gif = Buffer.from('GIF89a..........');
  assert.equal(detectImageKind(gif), 'unknown');
  assert.equal(inspectImageBytes(gif).ok, false);
  const truncated = Buffer.from([0xff, 0xd8, 0xff]);
  const inspected = inspectImageBytes(truncated);
  assert.equal(inspected.ok, false);
  assert.equal(inspected.kind, 'jpeg');
});

test('validateArtworkImageFile rejects contents that do not match the declared type', async () => {
  const png = await pngBytes(20, 20);
  const inspection = inspectImageBytes(png);
  const result = validateArtworkImageFile(
    { name: 'lot.jpg', type: 'image/jpeg', size: png.length },
    constraints,
    inspection,
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'invalid_image');
});

test('validateArtworkImageFile still accepts a JPEG that the bucket allows', async () => {
  const jpeg = await jpegBytes(32, 32);
  const inspection = inspectImageBytes(jpeg);
  const result = validateArtworkImageFile(
    { name: 'lot.jpg', type: 'image/jpeg', size: jpeg.length },
    constraints,
    inspection,
  );
  assert.equal(result.ok, true);
});

test('warns about low-resolution images without blocking them', async () => {
  const jpeg = await jpegBytes(400, 300);
  const inspection = inspectImageBytes(jpeg);
  const warnings = imageInspectionWarnings(inspection, { fileSize: jpeg.length, fileSizeLimitBytes: 10_485_760 });
  assert.equal(inspection.width < LOW_RESOLUTION_MIN_EDGE, true);
  assert.ok(warnings.some((item) => /Low resolution/.test(item)));
});
