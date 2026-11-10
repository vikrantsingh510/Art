import assert from 'node:assert/strict';
import test from 'node:test';
import { detectArCapability, isSecureArContext, stopMediaStream } from '../lib/ar-capability.js';
import { identityMat4, multiplyMat4 } from '../lib/ar-webgl.js';
import { artworkPhysicalSizeMetres, normalizeDimensionUnit, toMetres } from '../lib/dimensions.js';

test('AR capability is honest about iOS and insecure contexts', () => {
  const insecure = detectArCapability({
    xr: { isSessionSupported: async () => true },
    locationLike: { protocol: 'http:', hostname: 'example.com' },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120',
  });
  assert.equal(insecure.secure, false);
  assert.equal(insecure.liveArLikely, false);
  assert.equal(insecure.photoFallback, true);

  const ios = detectArCapability({
    xr: { isSessionSupported: async () => true },
    locationLike: { protocol: 'https:', hostname: 'maison.test' },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  });
  assert.equal(ios.ios, true);
  assert.equal(ios.liveArLikely, false);

  const androidHttps = detectArCapability({
    xr: { isSessionSupported: async () => true },
    locationLike: { protocol: 'https:', hostname: 'maison.test' },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120',
  });
  assert.equal(androidHttps.liveArLikely, true);
  assert.equal(isSecureArContext({ protocol: 'http:', hostname: 'localhost' }), true);
});

test('camera tracks are stopped on cleanup', () => {
  let stopped = 0;
  const stream = {
    getTracks() {
      return [
        { stop() { stopped += 1; } },
        { stop() { stopped += 1; } },
      ];
    },
  };
  assert.equal(stopMediaStream(stream), 2);
  assert.equal(stopped, 2);
  assert.equal(stopMediaStream(null), 0);
});

test('column-major identity multiply is stable', () => {
  const identity = identityMat4();
  const product = multiplyMat4(identity, identity);
  assert.deepEqual(Array.from(product), Array.from(identity));
});

test('artwork dimensions convert to metres for placement scale', () => {
  assert.equal(normalizeDimensionUnit('Inches'), 'in');
  assert.equal(toMetres(100, 'cm'), 1);
  const size = artworkPhysicalSizeMetres({ width: 80, height: 60, dimensionUnit: 'cm' });
  assert.equal(size.widthM, 0.8);
  assert.equal(artworkPhysicalSizeMetres({ width: 80, height: 0, dimensionUnit: 'cm' }), null);
});
