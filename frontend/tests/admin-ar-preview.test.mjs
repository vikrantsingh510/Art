import assert from 'node:assert/strict';
import test from 'node:test';
import { describeAdminArReadiness, ADMIN_AR_STATUS } from '../lib/ar-assets/admin-preview.js';
import { publishAdminArAssets } from '../lib/ar-assets/admin-pipeline.js';

const matchingPixels = { width: 2000, height: 1500 };

test('matching published JPEG is AR Ready and can generate and publish', () => {
  const preview = describeAdminArReadiness({
    width: 200,
    height: 150,
    depth: 4,
    unit: 'cm',
    status: 'published',
    pixels: matchingPixels,
    imageKind: 'jpeg',
    imageOk: true,
  });
  assert.equal(preview.code, ADMIN_AR_STATUS.READY);
  assert.equal(preview.label, 'AR Ready');
  assert.equal(preview.canGenerate, true);
  assert.equal(preview.canPublish, true);
  assert.equal(preview.deltaPct < 2, true);
});

test('missing unit is Missing Physical Dimensions and never inferred', () => {
  const preview = describeAdminArReadiness({
    width: 200,
    height: 150,
    status: 'published',
    pixels: matchingPixels,
    imageKind: 'jpeg',
    imageOk: true,
  });
  assert.equal(preview.code, ADMIN_AR_STATUS.MISSING_PHYSICAL);
  assert.ok(preview.reasons.includes('missing-unit'));
  assert.equal(preview.canGenerate, false);
});

test('zero or negative dimensions are ineligible', () => {
  const preview = describeAdminArReadiness({
    width: 0,
    height: -12,
    unit: 'cm',
    status: 'published',
    pixels: matchingPixels,
    imageKind: 'png',
    imageOk: true,
  });
  assert.equal(preview.code, ADMIN_AR_STATUS.MISSING_PHYSICAL);
  assert.equal(preview.canPublish, false);
});

test('aspect mismatch above 2% is reported without changing catalogue values', () => {
  const preview = describeAdminArReadiness({
    width: 90,
    height: 120,
    unit: 'cm',
    status: 'published',
    pixels: { width: 6720, height: 10000 },
    imageKind: 'jpeg',
    imageOk: true,
  });
  assert.equal(preview.code, ADMIN_AR_STATUS.ASPECT_MISMATCH);
  assert.ok(preview.deltaPct > 2);
  assert.match(preview.explanation, /2%/);
  assert.equal(preview.canGenerate, false);
});

test('WebP is unsupported for AR while remaining a possible gallery file', () => {
  const preview = describeAdminArReadiness({
    width: 200,
    height: 150,
    unit: 'cm',
    status: 'published',
    pixels: matchingPixels,
    imageKind: 'webp',
    imageOk: true,
  });
  assert.equal(preview.code, ADMIN_AR_STATUS.UNSUPPORTED_IMAGE);
  assert.equal(preview.canGenerate, false);
});

test('draft matching work can generate but not publish; reserved and archived cannot publish', () => {
  const draft = describeAdminArReadiness({
    width: 200,
    height: 150,
    unit: 'cm',
    status: 'draft',
    pixels: matchingPixels,
    imageKind: 'jpeg',
    imageOk: true,
  });
  assert.equal(draft.code, ADMIN_AR_STATUS.NOT_READY);
  assert.equal(draft.canGenerate, true);
  assert.equal(draft.canPublish, false);

  const reserved = describeAdminArReadiness({
    width: 200,
    height: 150,
    unit: 'cm',
    status: 'reserved',
    pixels: matchingPixels,
    imageKind: 'jpeg',
    imageOk: true,
  });
  assert.equal(reserved.canPublish, false);

  const archived = describeAdminArReadiness({
    width: 200,
    height: 150,
    unit: 'cm',
    status: 'archived',
    pixels: matchingPixels,
    imageKind: 'jpeg',
    imageOk: true,
  });
  assert.equal(archived.canGenerate, false);
  assert.equal(archived.canPublish, false);
});

test('sold matching work remains publishable', () => {
  const preview = describeAdminArReadiness({
    width: 200,
    height: 150,
    unit: 'cm',
    status: 'sold',
    pixels: matchingPixels,
    imageKind: 'png',
    imageOk: true,
  });
  assert.equal(preview.code, ADMIN_AR_STATUS.READY);
  assert.equal(preview.canPublish, true);
});

test('publishAdminArAssets refuses reserved lots without calling storage', async () => {
  const published = await publishAdminArAssets({
    artwork: { id: '20015000-0000-4000-8000-000000000001', status: 'reserved' },
    generated: { ready: true, assetsValid: true, files: { glb: Buffer.from('x'), usdz: Buffer.from('y') } },
    storage: {
      async upload() {
        throw new Error('should not upload');
      },
    },
  });
  assert.equal(published.ok, false);
  assert.equal(published.step, 'eligibility');
});
