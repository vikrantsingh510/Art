import { sha256Hex } from './hash.js';
import { parsePhysicalDimensions } from './physical.js';
import { catalogueMatchesManifest } from './storefront.js';
import {
  CURRENT_JSON,
  GLB_FILE,
  USDZ_FILE,
  versionGlbPath,
  versionManifestPath,
  versionUsdzPath,
} from './storage-paths.js';
import { assertGlbMatchesPhysical, assertUsdzContainer } from './validate.js';

export function pointerIsComplete(pointer) {
  return Boolean(
    pointer
    && pointer.contentHash
    && pointer.versionDir
    && pointer.versionDir === pointer.contentHash
    && pointer.assetsValid === true
    && pointer.ready === true
    && pointer.files?.glb
    && pointer.files?.usdz
    && pointer.files?.manifest,
  );
}

export function sourceImageMatchesManifest(imageBuffer, manifest) {
  if (!imageBuffer?.length || !manifest?.sourceImageSha256) {
    return false;
  }
  return sha256Hex(imageBuffer) === manifest.sourceImageSha256;
}

export function verifyAssetBuffers({
  glb,
  usdz,
  manifest,
  physical,
} = {}) {
  if (!glb?.length || !usdz?.length) {
    return { ok: false, reason: 'missing-assets' };
  }
  if (!manifest) {
    return { ok: false, reason: 'missing-manifest' };
  }
  if (manifest.glbSha256 && sha256Hex(glb) !== manifest.glbSha256) {
    return { ok: false, reason: 'hash-mismatch' };
  }
  if (manifest.usdzSha256 && sha256Hex(usdz) !== manifest.usdzSha256) {
    return { ok: false, reason: 'hash-mismatch' };
  }
  const expected = physical
    || (manifest.widthM > 0 && manifest.heightM > 0
      ? { widthM: manifest.widthM, heightM: manifest.heightM }
      : null);
  if (!expected || !(expected.widthM > 0) || !(expected.heightM > 0)) {
    return { ok: false, reason: 'missing-physical' };
  }
  try {
    const plane = assertGlbMatchesPhysical(glb, expected);
    assertUsdzContainer(usdz);
    return {
      ok: true,
      plane,
      glbBytes: glb.length,
      usdzBytes: usdz.length,
      glbSha256: sha256Hex(glb),
      usdzSha256: sha256Hex(usdz),
    };
  } catch (error) {
    return { ok: false, reason: 'invalid-assets', error: error.message };
  }
}

export function catalogueIntegrityReasons(artwork, manifest, {
  sourceImageBuffer = null,
  sourceImageRequired = false,
} = {}) {
  const reasons = [];
  const physical = parsePhysicalDimensions(artwork || {});
  if (!physical.ok) {
    reasons.push(...physical.reasons);
  }
  if (!manifest) {
    reasons.push('missing-manifest');
    return [...new Set(reasons)];
  }
  if (!catalogueMatchesManifest(artwork, manifest)) {
    reasons.push('stale-hash');
  }
  if (sourceImageBuffer?.length) {
    if (!sourceImageMatchesManifest(sourceImageBuffer, manifest)) {
      reasons.push('stale-source-image');
    }
  } else if (sourceImageRequired) {
    reasons.push('source-image-unavailable');
  }
  return [...new Set(reasons)];
}

export function versionPathsFor(artworkId, contentHash) {
  return {
    glb: versionGlbPath(artworkId, contentHash),
    usdz: versionUsdzPath(artworkId, contentHash),
    manifest: versionManifestPath(artworkId, contentHash),
    current: `${artworkId}/${CURRENT_JSON}`,
    files: {
      glb: `${contentHash}/${GLB_FILE}`,
      usdz: `${contentHash}/${USDZ_FILE}`,
      manifest: `${contentHash}/manifest.json`,
    },
  };
}
