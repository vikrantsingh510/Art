import { ASPECT_MATCH_MAX_DELTA_PCT } from './constants.js';

/**
 * Compare uploaded image aspect to admin physical aspect.
 * Never stretch, crop, or rewrite catalogue dimensions.
 */
export function compareAspect({ physicalAspect, pixelWidth, pixelHeight }) {
  if (!(physicalAspect > 0) || !(pixelWidth > 0) || !(pixelHeight > 0)) {
    return {
      ok: false,
      matches: false,
      reasons: ['missing-image'],
      imageAspect: null,
      physicalAspect: physicalAspect || null,
      deltaPct: null,
    };
  }

  const imageAspect = pixelWidth / pixelHeight;
  const deltaPct = Math.abs(physicalAspect - imageAspect) / physicalAspect * 100;
  const matches = deltaPct <= ASPECT_MATCH_MAX_DELTA_PCT;
  return {
    ok: true,
    matches,
    reasons: matches ? [] : ['aspect-mismatch'],
    imageAspect,
    physicalAspect,
    deltaPct,
    pixelWidth,
    pixelHeight,
    tolerancePct: ASPECT_MATCH_MAX_DELTA_PCT,
  };
}
