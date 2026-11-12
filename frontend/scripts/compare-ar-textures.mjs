import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXTURE_COMPARE_EDGES, TEXTURE_JPEG_QUALITY } from '../lib/ar-assets/constants.js';
import { generateArAssets } from '../lib/ar-assets/generate.js';
import { writeArAssetBundle } from '../lib/ar-assets/persist.js';
import { jpegDimensions } from '../lib/ar-poc-generate.js';
import { optimiseTexture } from '../lib/ar-assets/texture.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studyDir = path.join(root, 'public/ar-assets/_texture-study');
const sourcePath = path.join(root, 'public/dev/ar-poc/source.jpg');

if (!fs.existsSync(sourcePath)) {
  process.stderr.write(`Gallery original not found: ${sourcePath}\n`);
  process.exit(1);
}

fs.mkdirSync(studyDir, { recursive: true });
const sourceBefore = fs.statSync(sourcePath);
const source = fs.readFileSync(sourcePath);

const visual = [];
for (const maxEdge of TEXTURE_COMPARE_EDGES) {
  const processed = await optimiseTexture(source, {
    maxEdge,
    quality: TEXTURE_JPEG_QUALITY,
  });
  const name = `painting-contain-${maxEdge}.jpg`;
  fs.writeFileSync(path.join(studyDir, name), processed.buffer);
  visual.push({
    maxEdge,
    file: name,
    sourceBytes: source.length,
    outputBytes: processed.embeddedBytes,
    reductionPct: Number(((1 - processed.embeddedBytes / source.length) * 100).toFixed(1)),
    width: processed.width,
    height: processed.height,
    aspect: Number((processed.width / processed.height).toFixed(3)),
    sourceAspect: Number((processed.sourceWidth / processed.sourceHeight).toFixed(3)),
    downscaled: processed.downscaled,
  });
}

const pixels = jpegDimensions(source);
const matchingHeightCm = 100;
const matchingWidthCm = Number((matchingHeightCm * (pixels.width / pixels.height)).toFixed(2));

const meshes = [];
for (const maxEdge of TEXTURE_COMPARE_EDGES) {
  const result = await generateArAssets({
    artworkId: `texture-study-${maxEdge}`,
    status: 'published',
    width: matchingWidthCm,
    height: matchingHeightCm,
    unit: 'cm',
    imageBuffer: source,
    title: `Texture study ${maxEdge}`,
    textureMaxEdge: maxEdge,
  });
  writeArAssetBundle(result, path.join(studyDir, String(maxEdge)));
  meshes.push({
    maxEdge,
    generated: result.generated,
    ready: result.ready,
    assetsValid: result.assetsValid,
    widthCm: matchingWidthCm,
    heightCm: matchingHeightCm,
    widthM: result.physical.widthM,
    heightM: result.physical.heightM,
    measuredGlb: result.plane,
    textureBytes: result.manifest.textureBytes,
    sourceBytes: source.length,
    glbBytes: result.files?.glb?.length ?? null,
    usdzBytes: result.files?.usdz?.length ?? null,
    targetWidth: result.manifest.texture?.targetWidth,
    targetHeight: result.manifest.texture?.targetHeight,
    reduced: result.manifest.texture?.reduced ?? false,
    aspectMatches: result.aspect.matches,
  });
}

const sourceAfter = fs.statSync(sourcePath);
const comparison = {
  generatedAt: new Date().toISOString(),
  jpegQuality: TEXTURE_JPEG_QUALITY,
  galleryOriginal: {
    path: 'frontend/public/dev/ar-poc/source.jpg',
    bytesBefore: sourceBefore.size,
    bytesAfter: sourceAfter.size,
    unchanged: sourceBefore.size === sourceAfter.size && sourceBefore.mtimeMs === sourceAfter.mtimeMs,
  },
  visualContainOfGoldenPainting: {
    note: 'Same 0.672 image aspect as the gallery JPEG. These files are study outputs only; they are not written back over source.jpg and are not AR-ready meshes (90 × 120 cm still mismatches).',
    rows: visual,
  },
  matchingMeshStudy: {
    note: 'Same gallery JPEG bytes as source.jpg, with a study-only matching rectangle of 67.2 × 100 cm so aspect passes the generate gate. Catalogue size remains 90 × 120 cm, is not rewritten, and is still ineligible.',
    catalogueSizeUnchanged: '90 × 120 × 4 cm',
    hypotheticalMatchingSize: `${matchingWidthCm} × ${matchingHeightCm} cm`,
    sourceBytes: source.length,
    rows: meshes,
  },
  productionDefault: {
    maxEdge: 2048,
    rationale: '2048 px long-edge is the production default: GLB/USDZ bytes drop versus 4096 while remaining sharper than 1024 for wall-scale viewing.',
  },
};

fs.writeFileSync(
  path.join(studyDir, 'comparison.json'),
  `${JSON.stringify(comparison, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
