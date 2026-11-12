import { shouldShowArLaunchButton } from '../ar-poc-model-viewer.js';
import { evaluateArReadiness } from './eligibility.js';
import { formatPhysicalLabel, parsePhysicalDimensions } from './physical.js';

export const SIZE_GUIDE_REFERENCES = {
  sofa: {
    id: 'sofa',
    label: 'Sofa',
    widthCm: 220,
    heightCm: 85,
    caption: 'Typical three-seat sofa, 220 × 85 cm',
  },
  bed: {
    id: 'bed',
    label: 'Bed',
    widthCm: 160,
    heightCm: 50,
    caption: 'Queen headboard, 160 × 50 cm',
  },
  wall: {
    id: 'wall',
    label: 'Wall',
    widthCm: 400,
    heightCm: 280,
    caption: 'Representative interior wall, 400 × 280 cm',
  },
};

export function sameDimensionValue(left, right) {
  if (left === null || left === undefined || left === '') {
    return right === null || right === undefined || right === '';
  }
  return Number(left) === Number(right);
}

export function catalogueMatchesManifest(artwork, manifest) {
  if (!manifest) {
    return false;
  }
  const physical = parsePhysicalDimensions(artwork);
  if (!physical.ok) {
    return false;
  }
  return physical.width === Number(manifest.width)
    && physical.height === Number(manifest.height)
    && physical.unit === manifest.unit
    && sameDimensionValue(physical.depth, manifest.depth);
}

export function publicArAssetUrl(artworkId, relativePath, origin) {
  if (!artworkId || !relativePath || !origin) {
    return null;
  }
  return `${String(origin).replace(/\/$/, '')}/${artworkId}/${String(relativePath).replace(/^\/+/, '')}`;
}

export function previewAspectRatio(artwork) {
  const physical = parsePhysicalDimensions(artwork);
  if (!physical.ok) {
    return { width: 4, height: 5, source: 'fallback' };
  }
  return {
    width: physical.width,
    height: physical.height,
    source: 'admin',
  };
}

export function shouldShowViewOnWall(arReady, canActivateAR) {
  return arReady === true && shouldShowArLaunchButton(canActivateAR);
}

export function shouldMountModelViewer(arReady, glbUrl, usdzUrl) {
  return arReady === true && Boolean(glbUrl) && Boolean(usdzUrl);
}

/**
 * Storefront eligibility. Uses Phase 2 evaluateArReadiness plus current.json
 * gates. Does not re-decode gallery pixels; aspect comes from the validated
 * manifest. Stale catalogue dimensions hide the CTA instead of loading old files.
 */
export function evaluateStorefrontAr({
  artwork = {},
  current = null,
  manifest = null,
  assetsPresent = false,
  imageAvailable = false,
  sourceImageSha256 = null,
}) {
  const extra = [];
  if (!current) {
    extra.push('missing-current');
  } else {
    if (current.ready !== true || current.assetsValid !== true) {
      extra.push('generation-not-ready');
    }
    if (!current.files?.glb || !current.files?.usdz) {
      extra.push('missing-assets');
    }
    if (current.versionDir && current.contentHash && current.versionDir !== current.contentHash) {
      extra.push('stale-pointer');
    }
    if (manifest?.contentHash && current.contentHash && manifest.contentHash !== current.contentHash) {
      extra.push('stale-hash');
    }
  }
  if (sourceImageSha256 && manifest?.sourceImageSha256 && sourceImageSha256 !== manifest.sourceImageSha256) {
    extra.push('stale-source-image');
  }

  if (manifest?.aspect && manifest.aspect.matches === false) {
    extra.push('aspect-mismatch');
  }
  if (manifest && !catalogueMatchesManifest(artwork, manifest)) {
    extra.push('stale-hash');
  }

  const eligibility = evaluateArReadiness({
    artwork: {
      ...artwork,
      expectedHash: current?.contentHash || undefined,
    },
    imageAvailable,
    imageBuffer: null,
    manifest,
    assetsPresent,
    current,
  });

  const reasons = [...new Set([...eligibility.reasons, ...extra])];
  return {
    ready: reasons.length === 0,
    reasons,
    physical: eligibility.physical,
    aspect: eligibility.aspect,
    physicalLabel: eligibility.physicalLabel || formatPhysicalLabel({
      width: eligibility.physical.width,
      height: eligibility.physical.height,
      depth: eligibility.physical.depth,
      unit: eligibility.physical.unit,
    }),
  };
}

export function sizeGuideArtworkCm(artwork) {
  const physical = parsePhysicalDimensions(artwork);
  if (!physical.ok) {
    return null;
  }
  return {
    widthCm: physical.widthM * 100,
    heightCm: physical.heightM * 100,
    physical,
    physicalLabel: formatPhysicalLabel(physical),
  };
}

export function sizeGuideLayout(artworkCm, reference) {
  if (!artworkCm || !reference) {
    return null;
  }
  const worldH = Math.max(artworkCm.heightCm, reference.heightCm);
  if (!(worldH > 0) || !(artworkCm.widthCm > 0) || !(reference.widthCm > 0)) {
    return null;
  }
  return {
    artwork: {
      heightPct: (artworkCm.heightCm / worldH) * 100,
      aspect: artworkCm.widthCm / artworkCm.heightCm,
    },
    reference: {
      heightPct: (reference.heightCm / worldH) * 100,
      aspect: reference.widthCm / reference.heightCm,
    },
  };
}

export function serializeStorefrontAr(evaluation, {
  artworkId,
  current = null,
  glbPresent = false,
  usdzPresent = false,
  assetOrigin = null,
} = {}) {
  const ready = evaluation.ready === true && glbPresent && usdzPresent;
  return {
    ready,
    reasons: evaluation.reasons,
    physicalLabel: evaluation.physicalLabel,
    widthM: evaluation.physical?.widthM ?? null,
    heightM: evaluation.physical?.heightM ?? null,
    contentHash: current?.contentHash || null,
    glbUrl: ready ? publicArAssetUrl(artworkId, current?.files?.glb, assetOrigin) : null,
    usdzUrl: ready ? publicArAssetUrl(artworkId, current?.files?.usdz, assetOrigin) : null,
  };
}
