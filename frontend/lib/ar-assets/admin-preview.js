import { compareAspect } from './aspect-compare.js';
import { statusBlockReason } from './eligibility-status.js';
import { formatPhysicalLabel, parsePhysicalDimensions } from './physical.js';
import { AR_SOURCE_IMAGE_KINDS } from '../artwork-image-inspect.js';

export const ADMIN_AR_STATUS = {
  READY: 'ar-ready',
  NOT_READY: 'ar-not-ready',
  MISSING_PHYSICAL: 'missing-physical',
  ASPECT_MISMATCH: 'aspect-mismatch',
  UNSUPPORTED_IMAGE: 'unsupported-image',
};

export const ADMIN_AR_LABELS = {
  [ADMIN_AR_STATUS.READY]: 'AR Ready',
  [ADMIN_AR_STATUS.NOT_READY]: 'AR Not Ready',
  [ADMIN_AR_STATUS.MISSING_PHYSICAL]: 'Missing Physical Dimensions',
  [ADMIN_AR_STATUS.ASPECT_MISMATCH]: 'Aspect Ratio Mismatch',
  [ADMIN_AR_STATUS.UNSUPPORTED_IMAGE]: 'Unsupported or Invalid Image',
};

function formatRatio(value) {
  if (!(value > 0)) {
    return null;
  }
  return Number(value.toFixed(4));
}

/**
 * Admin AR preview. Does not generate meshes and does not publish.
 * Customer-facing AR still requires published/sold plus valid assets.
 */
export function describeAdminArReadiness({
  width,
  height,
  depth,
  unit,
  dimensionUnit,
  status,
  pixels = null,
  imageKind = null,
  imageOk = true,
} = {}) {
  const physical = parsePhysicalDimensions({
    width,
    height,
    depth,
    unit,
    dimensionUnit,
  });
  const pixelWidth = pixels?.width;
  const pixelHeight = pixels?.height;
  const kind = imageKind || null;
  const unsupported = imageOk === false
    || (kind && !AR_SOURCE_IMAGE_KINDS.includes(kind))
    || (!pixelWidth && !pixelHeight && imageOk === false);

  const aspect = physical.ok && pixelWidth > 0 && pixelHeight > 0
    ? compareAspect({
      physicalAspect: physical.physicalAspect,
      pixelWidth,
      pixelHeight,
    })
    : {
      matches: false,
      imageAspect: pixelWidth > 0 && pixelHeight > 0 ? pixelWidth / pixelHeight : null,
      physicalAspect: physical.physicalAspect ?? null,
      deltaPct: null,
      reasons: physical.ok ? ['missing-image'] : physical.reasons,
    };

  const statusReason = statusBlockReason(status);
  let code = ADMIN_AR_STATUS.NOT_READY;
  const reasons = [];

  if (imageOk === false || (kind && kind !== 'jpeg' && kind !== 'png' && kind !== null)) {
    code = ADMIN_AR_STATUS.UNSUPPORTED_IMAGE;
    reasons.push(imageOk === false ? 'invalid-image' : 'unsupported-image');
  } else if (!physical.ok) {
    code = ADMIN_AR_STATUS.MISSING_PHYSICAL;
    reasons.push(...physical.reasons);
  } else if (!(pixelWidth > 0) || !(pixelHeight > 0)) {
    code = ADMIN_AR_STATUS.UNSUPPORTED_IMAGE;
    reasons.push('missing-image');
  } else if (!aspect.matches) {
    code = ADMIN_AR_STATUS.ASPECT_MISMATCH;
    reasons.push('aspect-mismatch');
  } else if (statusReason) {
    code = ADMIN_AR_STATUS.NOT_READY;
    reasons.push(statusReason);
  } else {
    code = ADMIN_AR_STATUS.READY;
  }

  const canGenerate = Boolean(
    physical.ok
    && aspect.matches
    && pixelWidth > 0
    && pixelHeight > 0
    && (kind == null || AR_SOURCE_IMAGE_KINDS.includes(kind))
    && imageOk !== false
    && status !== 'archived',
  );
  const canPublish = canGenerate && !statusReason;

  let explanation = null;
  if (code === ADMIN_AR_STATUS.ASPECT_MISMATCH && aspect.deltaPct != null) {
    explanation = `Image aspect ${formatRatio(aspect.imageAspect)} and physical aspect ${formatRatio(aspect.physicalAspect)} differ by ${aspect.deltaPct.toFixed(1)}%, which is above the 2% AR tolerance. Catalogue size and the original image are unchanged.`;
  } else if (code === ADMIN_AR_STATUS.MISSING_PHYSICAL) {
    explanation = 'Enter a positive width, height and an explicit unit (mm, cm or in). Physical size is never taken from image pixels.';
  } else if (code === ADMIN_AR_STATUS.UNSUPPORTED_IMAGE) {
    explanation = 'AR generation needs a valid JPEG or PNG. Gallery upload can still use other types the artwork-images bucket allows.';
  } else if (code === ADMIN_AR_STATUS.NOT_READY && statusReason) {
    explanation = 'Customer AR publishing is limited to published or sold lots. Draft, reserved and archived works can be saved normally.';
  }

  return {
    code,
    label: ADMIN_AR_LABELS[code],
    reasons: [...new Set(reasons)],
    explanation,
    physical,
    physicalLabel: formatPhysicalLabel({
      width: physical.width,
      height: physical.height,
      depth: physical.depth,
      unit: physical.unit,
    }),
    pixels: pixelWidth > 0 && pixelHeight > 0 ? { width: pixelWidth, height: pixelHeight } : null,
    imageAspect: formatRatio(aspect.imageAspect),
    physicalAspect: formatRatio(aspect.physicalAspect),
    deltaPct: aspect.deltaPct == null ? null : Number(aspect.deltaPct.toFixed(2)),
    canGenerate,
    canPublish,
    customerStatusBlocked: Boolean(statusReason),
    unsupported,
  };
}
