import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatDimensions } from '../lib/format.js';
import {
  SIZE_GUIDE_REFERENCES,
  sizeGuideArtworkCm,
  sizeGuideLayout,
} from '../lib/ar-assets/storefront.js';
import {
  SIZE_GUIDE_SCENE_ORDER,
  sizeGuideAxisLabel,
  sizeGuideComparisonCopy,
  sizeGuideComparisons,
  sizeGuideDimensionFields,
  sizeGuideScene,
} from '../lib/size-guide-scene.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function assertSharedScale(scene, artworkCm, reference) {
  const widthScale = scene.artwork.widthPct / scene.furniture.widthPct;
  const heightScale = scene.artwork.heightPct / scene.furniture.heightPct;
  assert.equal(Number(widthScale.toFixed(8)), Number((artworkCm.widthCm / reference.widthCm).toFixed(8)));
  assert.equal(Number(heightScale.toFixed(8)), Number((artworkCm.heightCm / reference.heightCm).toFixed(8)));
  assert.equal(Number(scene.artwork.aspect.toFixed(8)), Number((artworkCm.widthCm / artworkCm.heightCm).toFixed(8)));
  assert.equal(Number(scene.furniture.aspect.toFixed(8)), Number((reference.widthCm / reference.heightCm).toFixed(8)));
}

test('size guide scenes keep catalogued artwork aspect and shared furniture scale', () => {
  const samples = [
    { width: 90, height: 120, depth: 4, dimensionUnit: 'cm' },
    { width: 200, height: 150, dimensionUnit: 'cm' },
    { width: 100, height: 100, depth: 3, dimensionUnit: 'cm' },
    { width: 36, height: 48, dimensionUnit: 'in' },
  ];

  for (const artwork of samples) {
    const artworkCm = sizeGuideArtworkCm(artwork);
    assert.ok(artworkCm);
    for (const id of SIZE_GUIDE_SCENE_ORDER) {
      const reference = SIZE_GUIDE_REFERENCES[id];
      const scene = sizeGuideScene(artworkCm, reference);
      const layout = sizeGuideLayout(artworkCm, reference);
      assert.ok(scene);
      assertSharedScale(scene, artworkCm, reference);
      assert.equal(Number(scene.artwork.aspect.toFixed(8)), Number(layout.artwork.aspect.toFixed(8)));
    }
  }
});

test('size guide dimension fields read catalogued values and never invent centimetres', () => {
  const artwork = { width: 90, height: 120, depth: 4, dimensionUnit: 'cm' };
  const fields = sizeGuideDimensionFields(artwork);
  assert.deepEqual(fields.map((field) => field.display), ['90 cm', '120 cm', '4 cm']);
  assert.equal(sizeGuideAxisLabel(fields), 'Width × Height × Depth');
  assert.equal(formatDimensions(artwork), '90 × 120 × 4 cm');

  const inches = sizeGuideDimensionFields({ width: 36, height: 48, dimensionUnit: 'in' });
  assert.deepEqual(inches.map((field) => field.display), ['36 in', '48 in']);
  assert.equal(sizeGuideAxisLabel(inches), 'Width × Height');
  assert.equal(inches.some((field) => field.id === 'depth'), false);
});

test('comparison copy distinguishes catalogued artwork size from representative furniture centimetres', () => {
  const artwork = { width: 90, height: 120, depth: 4, dimensionUnit: 'cm' };
  const artworkCm = sizeGuideArtworkCm(artwork);
  const sofa = sizeGuideComparisonCopy(SIZE_GUIDE_REFERENCES.sofa, artwork, artworkCm);
  assert.equal(sofa.title, 'Above a three-seater sofa');
  assert.equal(sofa.furnitureSize, '220 × 85 cm');
  assert.match(sofa.body, /90 × 120 × 4 cm/);

  const bed = sizeGuideComparisonCopy(SIZE_GUIDE_REFERENCES.bed, artwork, artworkCm);
  assert.equal(bed.title, 'Above a bed');
  assert.equal(bed.furnitureSize, '160 × 50 cm');
  assert.match(bed.body, /90 × 120 × 4 cm/);

  const wall = sizeGuideComparisonCopy(SIZE_GUIDE_REFERENCES.wall, artwork, artworkCm);
  assert.equal(wall.title, 'On a representative wall');
  assert.equal(wall.furnitureSize, '400 × 280 cm');
  assert.match(wall.body, /90 × 120 × 4 cm/);
});

test('size guide comparisons are presentation-only and leave the artwork record unchanged', () => {
  const artwork = { width: 90, height: 120, depth: 4, dimensionUnit: 'cm' };
  const snapshot = JSON.stringify(artwork);
  const rows = sizeGuideComparisons(artwork);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.reference.id), ['sofa', 'bed', 'wall']);
  assert.equal(JSON.stringify(artwork), snapshot);
  assert.equal(sizeGuideComparisons({ title: 'No size' }).length, 0);
});

test('wall overlay uses the wall as the scene instead of stacking the painting above it', () => {
  const artworkCm = sizeGuideArtworkCm({ width: 90, height: 120, dimensionUnit: 'cm' });
  const scene = sizeGuideScene(artworkCm, SIZE_GUIDE_REFERENCES.wall);
  assert.equal(Number(scene.sceneAspect.toFixed(4)), Number((400 / 280).toFixed(4)));
  assert.equal(Number(scene.furniture.widthPct.toFixed(4)), 100);
  assert.equal(Number(scene.furniture.heightPct.toFixed(4)), 100);
  assert.ok(scene.artwork.bottomPct > 20 && scene.artwork.bottomPct < 40);
});

test('stated furniture centimetres remain the existing storefront references', () => {
  assert.equal(SIZE_GUIDE_REFERENCES.sofa.widthCm, 220);
  assert.equal(SIZE_GUIDE_REFERENCES.sofa.heightCm, 85);
  assert.equal(SIZE_GUIDE_REFERENCES.bed.widthCm, 160);
  assert.equal(SIZE_GUIDE_REFERENCES.bed.heightCm, 50);
  assert.equal(SIZE_GUIDE_REFERENCES.wall.widthCm, 400);
  assert.equal(SIZE_GUIDE_REFERENCES.wall.heightCm, 280);
});

test('size guide UI is editorial, proportional, and does not add customer resizing', () => {
  const component = read('components/artwork-size-guide.js');
  const furniture = read('components/size-guide-furniture.js');
  const scene = read('lib/size-guide-scene.js');
  const page = read('app/(gallery)/artwork/[id]/page.js');

  assert.match(component, /See how this artwork fits your space/);
  assert.match(component, /Understand the actual size of this artwork through familiar furniture and room comparisons/);
  assert.match(component, /Width × Height × Depth|sizeGuideAxisLabel/);
  assert.match(component, /lg:grid-cols-3/);
  assert.match(component, /object-contain/);
  assert.match(component, /illustrative, not a measured room/);
  assert.match(component, /data-size-guide="ready"/);
  assert.doesNotMatch(component, /type="range"|resize|object-cover|90 × 120 × 4/);
  assert.doesNotMatch(component, /generateArAssets|evaluateArReadiness|WebXR|Quick Look|model-viewer/);
  assert.match(furniture, /SizeGuideSofa/);
  assert.match(furniture, /SizeGuideBed/);
  assert.match(furniture, /SizeGuideWall/);
  assert.match(scene, /SIZE_GUIDE_REFERENCES/);
  assert.match(scene, /sizeGuideArtworkCm/);
  assert.doesNotMatch(scene, /widthM\s*=|heightM\s*=/);
  assert.match(page, /ArtworkSizeGuide/);
});
