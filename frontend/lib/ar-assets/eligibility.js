import { compareAspect, imagePixelSize } from './aspect.js';
import { formatPhysicalLabel, parsePhysicalDimensions } from './physical.js';
import { statusBlockReason } from './eligibility-status.js';

export { statusBlockReason };

export function evaluateArReadiness({
  artwork = {},
  imageBuffer = null,
  imageAvailable = Boolean(imageBuffer && imageBuffer.length),
  manifest = null,
  assetsPresent = false,
  current = null,
}) {
  const reasons = [];
  const statusReason = statusBlockReason(artwork.status);
  if (statusReason) {
    reasons.push(statusReason);
  }
  if (!imageAvailable) {
    reasons.push('missing-image');
  }

  const physical = parsePhysicalDimensions(artwork);
  if (!physical.ok) {
    reasons.push(...physical.reasons);
  }

  let aspect = {
    matches: false,
    reasons: ['missing-image'],
    deltaPct: null,
    imageAspect: null,
    physicalAspect: physical.physicalAspect ?? null,
  };

  if (imageBuffer && physical.ok) {
    const pixels = imagePixelSize(imageBuffer);
    if (!pixels) {
      reasons.push('unreadable-image');
    } else {
      aspect = compareAspect({
        physicalAspect: physical.physicalAspect,
        pixelWidth: pixels.width,
        pixelHeight: pixels.height,
      });
      if (!aspect.matches) {
        reasons.push('aspect-mismatch');
      }
    }
  }

  if (manifest) {
    if (manifest.assetsValid !== true) {
      reasons.push('generation-not-ready');
    }
    if (artwork.expectedHash && manifest.contentHash && artwork.expectedHash !== manifest.contentHash) {
      reasons.push('stale-hash');
    }
  } else {
    reasons.push('missing-manifest');
  }

  if (current) {
    if (artwork.expectedHash && current.contentHash && artwork.expectedHash !== current.contentHash) {
      reasons.push('stale-hash');
    }
    if (current.ready === true && current.assetsValid !== true) {
      reasons.push('generation-not-ready');
    }
  }

  if ((manifest?.assetsValid === true || current?.assetsValid === true) && !assetsPresent) {
    reasons.push('missing-assets');
  }

  const uniqueReasons = [...new Set(reasons)];
  const ready = uniqueReasons.length === 0;

  return {
    ready,
    reasons: uniqueReasons,
    physical,
    aspect,
    physicalLabel: formatPhysicalLabel({
      width: physical.width,
      height: physical.height,
      depth: physical.depth,
      unit: physical.unit,
    }),
  };
}

export function isArReady(input) {
  return evaluateArReadiness(input).ready === true;
}
