import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGlb,
  buildUsdz,
  jpegDimensions,
  planeSizeMetres,
  validateGlb,
  validateUsdz,
} from '../lib/ar-poc-generate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public/dev/ar-poc');
const sourcePath = path.join(outDir, 'source.jpg');

const catalogue = {
  artworkId: '506b0baa-f6e2-4d19-9922-7979b314fa69',
  title: 'A Moment of Innocence',
  artistName: 'Vishal Singh',
  width: 90,
  height: 120,
  unit: 'cm',
  depthCm: 4,
};

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing source image at ${sourcePath}`);
}

const imageBuffer = fs.readFileSync(sourcePath);
const pixels = jpegDimensions(imageBuffer);
if (!pixels) {
  throw new Error('Could not read JPEG dimensions.');
}

const plane = planeSizeMetres({
  width: catalogue.width,
  height: catalogue.height,
  unit: catalogue.unit,
  pixelWidth: pixels.width,
  pixelHeight: pixels.height,
});

const glb = buildGlb({
  imageBuffer,
  mimeType: 'image/jpeg',
  widthM: plane.widthM,
  heightM: plane.heightM,
});
validateGlb(glb);

const usdz = buildUsdz({
  imageBuffer,
  imageName: 'texture.jpg',
  widthM: plane.widthM,
  heightM: plane.heightM,
});
validateUsdz(usdz);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'painting.glb'), glb);
fs.writeFileSync(path.join(outDir, 'painting.usdz'), usdz);

const manifest = {
  ...catalogue,
  pixels,
  plane,
  generatedAt: new Date().toISOString(),
  files: {
    glb: '/dev/ar-poc/painting.glb',
    usdz: '/dev/ar-poc/painting.usdz',
    source: '/dev/ar-poc/source.jpg',
  },
  notes: [
    'Catalogue unit is explicit cm (not inferred).',
    'Plane height uses catalogue 120 cm. Plane width uses image aspect to avoid stretching.',
    'Catalogue width 90 cm vs plane width from image aspect is recorded in plane.catalogueWidthM vs plane.widthM.',
  ],
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  glbBytes: glb.length,
  usdzBytes: usdz.length,
  plane,
  pixels,
}, null, 2)}\n`);
