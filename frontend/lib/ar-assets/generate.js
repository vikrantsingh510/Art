import { buildGlb, buildUsdz, paintingTexcoords } from '../ar-poc-generate.js';
import {
  GENERATOR_VERSION,
  TEXTURE_JPEG_QUALITY,
  TEXTURE_MAX_EDGE,
  UV_CONVENTION,
} from './constants.js';
import { compareAspect, imagePixelSize } from './aspect.js';
import { statusBlockReason } from './eligibility.js';
import { contentHash, sha256Hex } from './hash.js';
import { formatPhysicalLabel, parsePhysicalDimensions } from './physical.js';
import { describeTextureProfile, optimiseTexture } from './texture.js';
import { assertGlbMatchesPhysical, assertUsdzContainer } from './validate.js';

/**
 * Build GLB/USDZ only when admin physical dimensions are valid and the image
 * aspect matches. Plane metres come from admin width × height only.
 * Mismatched works are flagged and never marked ready.
 */
export async function generateArAssets({
  artworkId,
  status,
  width,
  height,
  depth,
  unit,
  dimensionUnit,
  imageBuffer,
  title,
  textureMaxEdge = TEXTURE_MAX_EDGE,
  textureQuality = TEXTURE_JPEG_QUALITY,
}) {
  const physical = parsePhysicalDimensions({
    width,
    height,
    depth,
    unit,
    dimensionUnit,
  });
  const pixels = imageBuffer ? imagePixelSize(imageBuffer) : null;
  const aspect = physical.ok && pixels
    ? compareAspect({
      physicalAspect: physical.physicalAspect,
      pixelWidth: pixels.width,
      pixelHeight: pixels.height,
    })
    : {
      matches: false,
      reasons: imageBuffer ? (physical.ok ? ['unreadable-image'] : physical.reasons) : ['missing-image'],
      deltaPct: null,
      imageAspect: null,
      physicalAspect: physical.physicalAspect ?? null,
    };

  const reasons = [];
  if (!physical.ok) {
    reasons.push(...physical.reasons);
  }
  if (!imageBuffer?.length) {
    reasons.push('missing-image');
  }
  if (imageBuffer?.length && !pixels) {
    reasons.push('unreadable-image');
  }
  if (aspect && !aspect.matches && pixels && physical.ok) {
    reasons.push('aspect-mismatch');
  }

  const uniqueReasons = [...new Set(reasons)];
  const canGenerate = uniqueReasons.length === 0 && physical.ok && aspect.matches;
  const hash = imageBuffer && physical.ok
    ? contentHash({
      imageBuffer,
      width: physical.width,
      height: physical.height,
      depth: physical.depth,
      unit: physical.unit,
      textureMaxEdge,
      textureQuality,
    })
    : null;

  const physicalLabel = formatPhysicalLabel({
    width: physical.width,
    height: physical.height,
    depth: physical.depth,
    unit: physical.unit,
  });

  const baseManifest = {
    artworkId: artworkId || null,
    title: title || null,
    status: status || null,
    generatorVersion: GENERATOR_VERSION,
    uvConvention: UV_CONVENTION,
    sourceImageSha256: imageBuffer ? sha256Hex(imageBuffer) : null,
    contentHash: hash,
    width: physical.width ?? (Number(width) || null),
    height: physical.height ?? (Number(height) || null),
    depth: physical.depth,
    unit: physical.unit,
    physicalLabel,
    widthM: physical.widthM,
    heightM: physical.heightM,
    depthM: physical.depthM,
    stretched: false,
    cropped: false,
    catalogueEdited: false,
    pixels,
    aspect: {
      imageAspect: aspect.imageAspect,
      physicalAspect: aspect.physicalAspect,
      deltaPct: aspect.deltaPct,
      matches: Boolean(aspect.matches),
      tolerancePct: aspect.tolerancePct ?? null,
    },
    gltfUvs: [...paintingTexcoords('gltf')],
    usdUvs: [...paintingTexcoords('usd')],
    texture: pixels ? describeTextureProfile(pixels, imageBuffer) : null,
    textureMaxEdge,
    textureQuality,
    reasons: uniqueReasons,
    customerCopy: physicalLabel
      ? `Actual size ${physicalLabel}. AR uses this size, not the on-screen preview.`
      : 'Physical dimensions are incomplete. This artwork is not AR-ready.',
    generatedAt: new Date().toISOString(),
  };

  if (!canGenerate) {
    return {
      ready: false,
      generated: false,
      assetsValid: false,
      reasons: uniqueReasons,
      physical,
      aspect,
      pixels,
      physicalLabel,
      files: null,
      manifest: {
        ...baseManifest,
        ready: false,
        assetsValid: false,
        files: { glb: null, usdz: null, texture: null },
      },
    };
  }

  let files = null;
  let plane = null;
  let processed = null;
  const generationReasons = [];

  try {
    processed = await optimiseTexture(imageBuffer, {
      maxEdge: textureMaxEdge,
      quality: textureQuality,
    });
    const glb = buildGlb({
      imageBuffer: processed.buffer,
      mimeType: 'image/jpeg',
      widthM: physical.widthM,
      heightM: physical.heightM,
    });
    const usdz = buildUsdz({
      imageBuffer: processed.buffer,
      imageName: 'texture.jpg',
      widthM: physical.widthM,
      heightM: physical.heightM,
    });
    plane = assertGlbMatchesPhysical(glb, physical);
    assertUsdzContainer(usdz);
    files = {
      glb,
      usdz,
      texture: processed.buffer,
    };
  } catch {
    files = null;
    plane = null;
    processed = null;
    generationReasons.push('generation-failed');
  }

  const assetsValid = Boolean(files?.glb && files?.usdz && plane);
  const statusReason = statusBlockReason(status);
  const allReasons = [...uniqueReasons, ...generationReasons];
  if (statusReason) {
    allReasons.push(statusReason);
  }
  const resultReasons = [...new Set(allReasons)];
  const customerReady = assetsValid && !statusReason && resultReasons.length === 0;

  return {
    ready: customerReady,
    generated: assetsValid,
    assetsValid,
    reasons: resultReasons,
    physical,
    aspect,
    pixels,
    physicalLabel,
    files: assetsValid ? files : null,
    plane: assetsValid ? plane : null,
    manifest: {
      ...baseManifest,
      texture: processed
        ? describeTextureProfile(pixels, imageBuffer, processed)
        : baseManifest.texture,
      ready: customerReady,
      assetsValid,
      reasons: resultReasons,
      files: assetsValid
        ? { glb: 'painting.glb', usdz: 'painting.usdz', texture: 'texture.jpg' }
        : { glb: null, usdz: null, texture: null },
      glbBytes: assetsValid ? files.glb.length : null,
      usdzBytes: assetsValid ? files.usdz.length : null,
      textureBytes: assetsValid ? files.texture.length : null,
      glbSha256: assetsValid ? sha256Hex(files.glb) : null,
      usdzSha256: assetsValid ? sha256Hex(files.usdz) : null,
      measuredGlb: assetsValid ? plane : null,
    },
  };
}
