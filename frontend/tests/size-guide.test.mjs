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
  SIZE_GUIDE_PHOTO_FILES,
  SIZE_GUIDE_PHOTO_FRAMES,
} from '../lib/size-guide-photos.js';
import {
  SIZE_GUIDE_SCENE_ORDER,
  sizeGuideAxisLabel,
  sizeGuideComparisonCopy,
  sizeGuideComparisons,
  sizeGuideDimensionFields,
  sizeGuidePhotoOverlay,
  sizeGuideScene,
} from '../lib/size-guide-scene.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function jpegDimensions(bytes) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return null;
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

test('photo overlays keep catalogued artwork aspect and scale from furniture width', () => {
  const portrait = sizeGuideArtworkCm({ width: 90, height: 120, depth: 4, dimensionUnit: 'cm' });
  const landscape = sizeGuideArtworkCm({ width: 200, height: 150, dimensionUnit: 'cm' });

  const sofa = sizeGuidePhotoOverlay(portrait, SIZE_GUIDE_REFERENCES.sofa, SIZE_GUIDE_PHOTO_FRAMES.sofa);
  assert.equal(Number(sofa.aspect.toFixed(8)), Number((90 / 120).toFixed(8)));
  assert.equal(sofa.clamped, false);
  assert.equal(
    Number((sofa.widthPct / SIZE_GUIDE_PHOTO_FRAMES.sofa.furnitureWidthPct).toFixed(8)),
    Number((90 / 220).toFixed(8)),
  );

  const wall = sizeGuidePhotoOverlay(portrait, SIZE_GUIDE_REFERENCES.wall, SIZE_GUIDE_PHOTO_FRAMES.wall);
  assert.equal(Number(wall.aspect.toFixed(8)), Number((90 / 120).toFixed(8)));
  assert.equal(wall.clamped, false);

  const bed = sizeGuidePhotoOverlay(portrait, SIZE_GUIDE_REFERENCES.bed, SIZE_GUIDE_PHOTO_FRAMES.bed);
  assert.equal(Number(bed.aspect.toFixed(8)), Number((90 / 120).toFixed(8)));
  assert.equal(bed.clamped, true);

  const landscapeSofa = sizeGuidePhotoOverlay(landscape, SIZE_GUIDE_REFERENCES.sofa, SIZE_GUIDE_PHOTO_FRAMES.sofa);
  assert.equal(Number(landscapeSofa.aspect.toFixed(8)), Number((200 / 150).toFixed(8)));
});

test('size guide photographs are the supplied extensionless JPEGs', () => {
  assert.equal(SIZE_GUIDE_PHOTO_FILES.sofa, 'size-guide-sofa');
  assert.equal(SIZE_GUIDE_PHOTO_FILES.bed, 'size-guide-bedroom');
  assert.equal(SIZE_GUIDE_PHOTO_FILES.wall, 'size-guide-wall');
  for (const file of Object.values(SIZE_GUIDE_PHOTO_FILES)) {
    const bytes = fs.readFileSync(path.join(frontendRoot, 'assets', 'images', file));
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e;
    assert.equal(jpeg || png, true, `${file} must be a JPEG or PNG`);
  }
  const photos = read('lib/size-guide-photos.js');
  const media = read('app/size-guide-media/[scene]/route.js');
  assert.match(photos, /size-guide-sofa/);
  assert.match(photos, /size-guide-bedroom/);
  assert.match(photos, /size-guide-wall/);
  assert.match(photos, /\/size-guide-media\/sofa/);
  assert.match(media, /SIZE_GUIDE_PHOTO_FILES/);
  assert.match(media, /image\/jpeg/);
  assert.match(media, /image\/png/);
  assert.match(media, /process\.cwd\(\)/);
  assert.match(media, /assets', 'images'/);
  const nextConfig = read('next.config.mjs');
  assert.match(nextConfig, /outputFileTracingRoot: import\.meta\.dirname/);
  assert.match(nextConfig, /outputFileTracingIncludes/);
  assert.match(nextConfig, /\/size-guide-media\/\[scene\]/);
  assert.match(nextConfig, /assets\/images\/size-guide-sofa/);
  assert.match(nextConfig, /assets\/images\/size-guide-bedroom/);
  assert.match(nextConfig, /assets\/images\/size-guide-wall/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.engines?.node, '24.x');
});

test('size guide UI is editorial, proportional, and does not add customer resizing', () => {
  const component = read('components/artwork-size-guide.js');
  const preview = read('components/size-guide-scene-preview.js');
  const lightbox = read('components/size-guide-scene-lightbox.js');
  const scene = read('lib/size-guide-scene.js');
  const page = read('app/(gallery)/artwork/[id]/page.js');

  assert.match(component, /See how this artwork fits your space/);
  assert.match(component, /Understand the actual size of this artwork through familiar furniture and room comparisons/);
  assert.match(component, /Width × Height × Depth|sizeGuideAxisLabel/);
  assert.match(component, /lg:grid-cols-3/);
  assert.match(component, /SizeGuideSceneLightbox/);
  assert.match(component, /illustrative, not a measured room/);
  assert.match(component, /data-size-guide="ready"/);
  assert.match(component, /visualization=\{visualization\}|visualization = null/);
  assert.match(component, /return visualization \|\| null/);
  assert.doesNotMatch(component, /'use client'/);
  assert.doesNotMatch(component, /size-guide space-y-10 overflow-x-hidden/);
  assert.match(component, /lg:grid-cols-3 gap-8 items-start overflow-x-hidden/);
  assert.match(preview, /object-cover/);
  assert.match(preview, /overlay\.widthPct/);
  assert.match(preview, /photo\.src/);
  assert.match(preview, /loading/);
  assert.match(lightbox, /loading=\{loading\}/);
  assert.match(component, /loading=\{index === 0 \? 'eager' : 'lazy'\}/);
  assert.doesNotMatch(component, /type="range"|resize|90 × 120 × 4/);
  assert.doesNotMatch(component, /generateArAssets|evaluateArReadiness|WebXR|Quick Look|model-viewer/);
  assert.doesNotMatch(component, /SizeGuideSofa|SizeGuideBed|SizeGuideWall|SizeGuideFurniture|SizeGuideDimensionDiagram/);
  assert.doesNotMatch(component, /data-size-guide-field|border-y border-fillet/);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'components/size-guide-furniture.js')), false);
  assert.match(scene, /SIZE_GUIDE_REFERENCES/);
  assert.match(scene, /sizeGuideArtworkCm/);
  assert.doesNotMatch(scene, /widthM\s*=|heightM\s*=/);
  assert.match(page, /ArtworkSizeGuide artwork=\{artwork\} visualization=\{visualization\}/);
  assert.match(lightbox, /role="dialog"/);
  assert.match(lightbox, /aria-modal="true"/);
  assert.match(lightbox, /Escape/);
  assert.match(lightbox, /createPortal/);
  assert.match(lightbox, /document\.body\.style\.overflow/);
  assert.match(lightbox, /stopPropagation/);
  assert.match(lightbox, /SizeGuideScenePreview/);
  assert.doesNotMatch(lightbox, /sizeGuideArtworkCm|sizeGuidePhotoOverlay/);
});

test('size guide lightbox switches sofa bed and wall without closing the modal', () => {
  const lightbox = read('components/size-guide-scene-lightbox.js');
  const component = read('components/artwork-size-guide.js');
  const css = read('app/globals.css');

  assert.match(component, /comparisons=\{comparisons\}/);
  assert.match(lightbox, /Sofa/);
  assert.match(lightbox, /Bed/);
  assert.match(lightbox, /Wall/);
  assert.match(lightbox, /role="tablist"/);
  assert.match(lightbox, /aria-selected=\{selected\}/);
  assert.match(lightbox, /function selectScene/);
  assert.match(lightbox, /setActiveId\(id\)/);
  assert.doesNotMatch(lightbox.split('function selectScene')[1].split('function ')[0], /setOpen\(false\)/);
  assert.match(lightbox, /if \(event\.key === 'Escape'\)/);
  assert.match(lightbox, /aria-label="Close size comparison"/);
  assert.match(css, /\.size-guide-lightbox-scene\.is-active/);
  assert.match(css, /\.size-guide-lightbox-scenes/);
  assert.match(lightbox, /createPortal\(/);
  assert.equal([...lightbox.matchAll(/createPortal\(/g)].length, 1);
  assert.doesNotMatch(lightbox, /window\.location|router\.push|href=\{/);
});

test('size guide lightbox fits the viewport without cropping scene photos', () => {
  const css = read('app/globals.css');
  const lightboxBlock = css.slice(css.indexOf('.size-guide-lightbox-backdrop'));

  assert.match(css, /\.size-guide-lightbox-backdrop\s*\{[^}]*overflow:\s*auto/);
  assert.match(css, /\.size-guide-lightbox-dialog\s*\{[^}]*width:\s*min\(96vw, 72rem\)/);
  assert.match(css, /\.size-guide-scene-lightbox\s*\{[^}]*width:\s*min\(100%, calc\(var\(--lightbox-image-max-height\) \* var\(--scene-aspect/);
  assert.match(css, /\.size-guide-scene-lightbox\s*\{[^}]*aspect-ratio:\s*var\(--scene-aspect/);
  assert.match(css, /\.size-guide-lightbox-close\s*\{[^}]*position:\s*sticky/);
  assert.doesNotMatch(lightboxBlock.slice(0, lightboxBlock.indexOf('@keyframes')), /78vh \* var\(--scene-aspect/);
  assert.doesNotMatch(lightboxBlock.slice(0, lightboxBlock.indexOf('@keyframes')), /80vh \* var\(--scene-aspect/);
  assert.doesNotMatch(css, /\.size-guide-scene-lightbox[^{]*\{[^}]*object-fit:\s*contain/);
  assert.match(css, /\.size-guide-photo\s*\{[^}]*object-fit:\s*cover/);
});

test('size guide lightbox uses 3:2 image thumbnails with scene-specific artwork overlays', () => {
  const lightbox = read('components/size-guide-scene-lightbox.js');
  const preview = read('components/size-guide-scene-preview.js');
  const css = read('app/globals.css');
  const thumbPreview = lightbox.split('size-guide-lightbox-thumb')[1].split('size-guide-lightbox-scene-label')[0];

  assert.match(thumbPreview, /framed=\{false\}/);
  assert.match(thumbPreview, /showOverlay=\{true\}/);
  assert.match(thumbPreview, /imageUrl=\{imageUrl\}/);
  assert.match(thumbPreview, /imageAlt=""/);
  assert.match(thumbPreview, /overlay=\{item\.overlay\}/);
  assert.match(thumbPreview, /photo=\{item\.photo\}/);
  assert.match(thumbPreview, /scene=\{item\.scene\}/);
  assert.doesNotMatch(thumbPreview, /showOverlay=\{false\}/);
  assert.match(lightbox, /size-guide-lightbox-thumb/);
  assert.match(lightbox, /size-guide-lightbox-scene-label/);
  assert.match(preview, /showOverlay = true/);
  assert.match(preview, /framed = true/);
  assert.match(preview, /showOverlay && overlay/);
  assert.match(css, /\.size-guide-lightbox-thumb\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*2/);
  assert.match(css, /\.size-guide-lightbox-thumb\s*\{[^}]*container-type:\s*inline-size/);
  assert.match(css, /\.size-guide-lightbox-scenes\s*\{[^}]*grid-template-columns:\s*repeat\(3/);
  assert.match(css, /\.size-guide-lightbox-scene\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.size-guide-scene-lightbox \.size-guide-artwork\s*\{/);
  assert.doesNotMatch(css, /\.size-guide-lightbox-thumb[^{]*\.size-guide-artwork/);
  assert.doesNotMatch(css, /\.size-guide-lightbox-thumb-preview[^{]*\.size-guide-artwork/);
});

test('sofa keeps a 3:2 presentation frame while bed and wall match served pixels', () => {
  assert.equal(SIZE_GUIDE_PHOTO_FRAMES.sofa.width, 1536);
  assert.equal(SIZE_GUIDE_PHOTO_FRAMES.sofa.height, 1024);
  assert.equal(SIZE_GUIDE_PHOTO_FRAMES.sofa.aspect, 1536 / 1024);
  assert.equal(SIZE_GUIDE_PHOTO_FRAMES.bed.width, 1536);
  assert.equal(SIZE_GUIDE_PHOTO_FRAMES.bed.height, 1024);
  assert.equal(SIZE_GUIDE_PHOTO_FRAMES.bed.aspect, 1536 / 1024);
  assert.equal(SIZE_GUIDE_PHOTO_FRAMES.wall.width, 1600);
  assert.equal(SIZE_GUIDE_PHOTO_FRAMES.wall.height, 1067);
  assert.equal(SIZE_GUIDE_PHOTO_FRAMES.wall.aspect, 1600 / 1067);

  const sofaFile = jpegDimensions(fs.readFileSync(path.join(frontendRoot, 'assets', 'images', SIZE_GUIDE_PHOTO_FILES.sofa)));
  const bedFile = jpegDimensions(fs.readFileSync(path.join(frontendRoot, 'assets', 'images', SIZE_GUIDE_PHOTO_FILES.bed)));
  const wallFile = jpegDimensions(fs.readFileSync(path.join(frontendRoot, 'assets', 'images', SIZE_GUIDE_PHOTO_FILES.wall)));
  assert.deepEqual(sofaFile, { width: 1214, height: 1214 });
  assert.deepEqual(bedFile, { width: 1536, height: 1024 });
  assert.deepEqual(wallFile, { width: 1600, height: 1067 });

  const portrait = sizeGuideArtworkCm({ width: 90, height: 120, depth: 4, dimensionUnit: 'cm' });
  const sofaOverlay = sizeGuidePhotoOverlay(portrait, SIZE_GUIDE_REFERENCES.sofa, SIZE_GUIDE_PHOTO_FRAMES.sofa);
  assert.equal(Number(sofaOverlay.widthPct.toFixed(8)), Number(((90 / 220) * 48).toFixed(8)));
  assert.equal(Number((sofaOverlay.heightPct / sofaOverlay.widthPct).toFixed(8)), Number((SIZE_GUIDE_PHOTO_FRAMES.sofa.aspect / (90 / 120)).toFixed(8)));
});

test('size guide artwork overlay uses a thin outer moulding without changing placement', () => {
  const css = read('app/globals.css');
  const preview = read('components/size-guide-scene-preview.js');
  const lightbox = read('components/size-guide-scene-lightbox.js');
  const component = read('components/artwork-size-guide.js');
  const scene = read('lib/size-guide-scene.js');
  const photos = read('lib/size-guide-photos.js');
  const artworkBlock = css.slice(css.indexOf('.size-guide-artwork {'), css.indexOf('.size-guide-artwork img'));
  const lightboxArtworkBlock = css.slice(css.indexOf('.size-guide-scene-lightbox .size-guide-artwork'));
  const photoBlock = css.slice(css.indexOf('.size-guide-photo'), css.indexOf('.size-guide-artwork {'));
  const triggerBlock = css.slice(css.indexOf('.size-guide-scene-trigger {'), css.indexOf('.size-guide-scene-trigger:hover'));
  const lightboxSceneBlock = css.slice(css.indexOf('.size-guide-scene-lightbox {'), css.indexOf('.size-guide-scene-lightbox .size-guide-artwork'));

  assert.match(triggerBlock, /container-type:\s*inline-size/);
  assert.match(lightboxSceneBlock, /container-type:\s*inline-size/);
  assert.doesNotMatch(artworkBlock, /container-type:\s*inline-size/);
  assert.match(artworkBlock, /0 0 0 clamp\(0\.75px, 0\.32cqi, 1\.35px\) var\(--color-olive\)/);
  assert.match(artworkBlock, /clamp\(0\.2px, 0\.1cqi, 0\.4px\)/);
  assert.match(lightboxArtworkBlock, /0 0 0 clamp\(2px, 0\.26cqi, 3px\) var\(--color-olive\)/);
  assert.match(lightboxArtworkBlock, /clamp\(0\.45px, 0\.065cqi, 0\.75px\)/);
  assert.match(css, /color-mix\(in srgb, var\(--color-antique\) 70%, var\(--color-ink\)\)/);
  assert.doesNotMatch(artworkBlock, /clamp\(1\.5px, 1\.15cqi, 3\.5px\)/);
  assert.doesNotMatch(artworkBlock, /\+ 1px\)/);
  assert.doesNotMatch(artworkBlock, /0 14px 32px/);
  assert.doesNotMatch(artworkBlock, /0 2px 6px/);
  assert.doesNotMatch(photoBlock, /container-type:\s*inline-size/);
  assert.doesNotMatch(photoBlock, /0\.32cqi|0\.26cqi/);
  assert.match(preview, /className="size-guide-artwork"/);
  assert.match(preview, /overlay\.widthPct/);
  assert.match(preview, /overlay\.heightPct/);
  assert.match(preview, /overlay\.leftPct/);
  assert.match(preview, /overlay\.bottomPct/);
  assert.doesNotMatch(preview, /perspective|rotateX|rotateY/);
  assert.doesNotMatch(artworkBlock, /perspective|rotate/);
  assert.match(lightbox, /showOverlay=\{true\}/);
  assert.match(lightbox, /imageAlt=""/);
  assert.match(component, /lg:grid-cols-3/);
  assert.match(photos, /\/size-guide-media\/sofa/);
  assert.match(photos, /\/size-guide-media\/bed/);
  assert.match(photos, /\/size-guide-media\/wall/);
  assert.doesNotMatch(scene, /perspective|rotateX|rotateY/);

  const portrait = sizeGuideArtworkCm({ width: 90, height: 120, depth: 4, dimensionUnit: 'cm' });
  const sofa = sizeGuidePhotoOverlay(portrait, SIZE_GUIDE_REFERENCES.sofa, SIZE_GUIDE_PHOTO_FRAMES.sofa);
  const bed = sizeGuidePhotoOverlay(portrait, SIZE_GUIDE_REFERENCES.bed, SIZE_GUIDE_PHOTO_FRAMES.bed);
  const wall = sizeGuidePhotoOverlay(portrait, SIZE_GUIDE_REFERENCES.wall, SIZE_GUIDE_PHOTO_FRAMES.wall);
  assert.equal(Number(sofa.widthPct.toFixed(8)), Number(((90 / 220) * 48).toFixed(8)));
  assert.equal(Number(sofa.leftPct.toFixed(8)), 40.18181818);
  assert.equal(Number(sofa.bottomPct.toFixed(8)), 52.5);
  assert.equal(bed.clamped, true);
  assert.equal(Number(wall.widthPct.toFixed(8)), Number(((90 / 400) * 77).toFixed(8)));
  assert.equal(Number(wall.leftPct.toFixed(4)), 44.3375);
  assert.equal(Number(wall.heightPct.toFixed(4)), 34.6392);
});
