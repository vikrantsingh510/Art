import fs from 'node:fs';
import path from 'node:path';
import { evaluateStorefrontAr, serializeStorefrontAr } from './storefront.js';

const PUBLIC_AR_ASSETS = path.join(process.cwd(), 'public', 'ar-assets');

function readJsonIfPresent(file) {
  try {
    if (!file || !fs.existsSync(file)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function fileNonEmpty(file) {
  try {
    return Boolean(file) && fs.existsSync(file) && fs.statSync(file).size > 0;
  } catch {
    return false;
  }
}

export function artworkArAssetsDir(artworkId, assetsRoot) {
  const root = assetsRoot || PUBLIC_AR_ASSETS;
  return path.join(/* turbopackIgnore: true */ root, artworkId);
}

/**
 * Server-only: current.json + non-empty GLB/USDZ + Phase 2 eligibility.
 * Never returns model URLs unless the artwork is storefront AR-ready.
 * Does not import the generator persist module.
 */
export function resolveArtworkArAssets(artwork, { assetsRoot, assetOrigin } = {}) {
  const artworkId = artwork?.id;
  const empty = serializeStorefrontAr(
    evaluateStorefrontAr({
      artwork: artwork || {},
      current: null,
      manifest: null,
      assetsPresent: false,
      imageAvailable: false,
    }),
    { artworkId, assetOrigin },
  );

  if (!artworkId) {
    return empty;
  }

  const artworkDir = artworkArAssetsDir(artworkId, assetsRoot);
  const current = readJsonIfPresent(path.join(/* turbopackIgnore: true */ artworkDir, 'current.json'));
  const versionDirName = current?.versionDir || null;
  const versionDir = versionDirName
    ? path.join(/* turbopackIgnore: true */ artworkDir, versionDirName)
    : null;
  const versionManifest = versionDir
    ? readJsonIfPresent(path.join(/* turbopackIgnore: true */ versionDir, 'manifest.json'))
    : null;
  const rootManifest = readJsonIfPresent(path.join(/* turbopackIgnore: true */ artworkDir, 'manifest.json'));
  const manifest = versionManifest || rootManifest;

  const glbRel = current?.files?.glb || null;
  const usdzRel = current?.files?.usdz || null;
  const glbPath = glbRel ? path.join(/* turbopackIgnore: true */ artworkDir, glbRel) : null;
  const usdzPath = usdzRel ? path.join(/* turbopackIgnore: true */ artworkDir, usdzRel) : null;
  const glbPresent = fileNonEmpty(glbPath);
  const usdzPresent = fileNonEmpty(usdzPath);
  const assetsPresent = glbPresent && usdzPresent && current?.assetsValid === true;
  const imageAvailable = (Array.isArray(artwork.images) && artwork.images.length > 0)
    || assetsPresent;

  const evaluation = evaluateStorefrontAr({
    artwork,
    current,
    manifest,
    assetsPresent,
    imageAvailable,
  });

  return serializeStorefrontAr(evaluation, {
    artworkId,
    current,
    glbPresent,
    usdzPresent,
    assetOrigin,
  });
}
