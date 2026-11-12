import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGlb,
  buildUsdz,
  jpegDimensions,
  paintingTexcoords,
  planeSizeMetres,
  validateGlb,
  validateUsdz,
} from '../lib/ar-poc-generate.js';

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

test('plane size uses explicit units and avoids stretching to catalogue aspect', () => {
  const plane = planeSizeMetres({
    width: 90,
    height: 120,
    unit: 'cm',
    pixelWidth: 6720,
    pixelHeight: 10000,
  });
  assert.equal(plane.heightM, 1.2);
  assert.equal(Number(plane.widthM.toFixed(4)), 0.8064);
  assert.equal(plane.stretched, false);
  assert.ok(plane.deltaPct > 10);
  assert.throws(() => planeSizeMetres({
    width: 90,
    height: 120,
    unit: null,
    pixelWidth: 100,
    pixelHeight: 100,
  }));
});

test('glTF UVs put v=0 at the top of the painting so WebXR is not upside-down', () => {
  const gltf = paintingTexcoords('gltf');
  const usd = paintingTexcoords('usd');
  // bottom-left, bottom-right, top-right, top-left
  assert.deepEqual([...gltf], [0, 1, 1, 1, 1, 0, 0, 0]);
  assert.deepEqual([...usd], [0, 0, 1, 0, 1, 1, 0, 1]);
});

test('JPEG SOF dimensions are read', () => {
  assert.deepEqual(jpegDimensions(stubJpeg(6720, 10000)), { width: 6720, height: 10000 });
});

test('GLB and USDZ containers validate', () => {
  const jpeg = stubJpeg(8, 8);
  const glb = buildGlb({
    imageBuffer: jpeg,
    widthM: 0.8,
    heightM: 1.2,
  });
  assert.equal(validateGlb(glb), true);
  const usdz = buildUsdz({
    imageBuffer: jpeg,
    widthM: 0.8,
    heightM: 1.2,
  });
  assert.equal(validateUsdz(usdz), true);
});
