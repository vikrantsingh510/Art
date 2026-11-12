import {
  MAX_EDGE_M,
  MIN_EDGE_M,
  SUPPORTED_UNITS,
  UNIT_TO_METRES,
} from './constants.js';

export function normalizeUnit(unit) {
  if (unit === undefined || unit === null || String(unit).trim() === '') {
    return null;
  }
  const key = String(unit).trim().toLowerCase();
  if (SUPPORTED_UNITS.includes(key)) {
    return key;
  }
  return null;
}

export function parsePositiveNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return number;
}

/**
 * Admin-entered width, height and unit are the only source of physical size.
 * Image pixels are not used. Unit is never inferred.
 */
export function parsePhysicalDimensions({ width, height, depth, unit, dimensionUnit }) {
  const reasons = [];
  const explicitUnit = normalizeUnit(unit ?? dimensionUnit);
  if (!explicitUnit) {
    reasons.push('missing-unit');
  }

  const widthAmount = parsePositiveNumber(width);
  const heightAmount = parsePositiveNumber(height);
  if (widthAmount === null) {
    reasons.push('missing-width');
  }
  if (heightAmount === null) {
    reasons.push('missing-height');
  }

  const depthRaw = depth === undefined || depth === null || depth === ''
    ? null
    : parsePositiveNumber(depth);
  if (depth !== undefined && depth !== null && depth !== '' && depthRaw === null) {
    reasons.push('invalid-depth');
  }

  if (reasons.length > 0) {
    return { ok: false, reasons, widthM: null, heightM: null, depthM: null, unit: explicitUnit };
  }

  const widthM = widthAmount * UNIT_TO_METRES[explicitUnit];
  const heightM = heightAmount * UNIT_TO_METRES[explicitUnit];
  const depthM = depthRaw === null ? null : depthRaw * UNIT_TO_METRES[explicitUnit];

  if (widthM < MIN_EDGE_M || heightM < MIN_EDGE_M || widthM > MAX_EDGE_M || heightM > MAX_EDGE_M) {
    return {
      ok: false,
      reasons: ['implausible-size'],
      widthM,
      heightM,
      depthM,
      unit: explicitUnit,
      width: widthAmount,
      height: heightAmount,
      depth: depthRaw,
    };
  }

  if (depthM !== null && (depthM < 0.001 || depthM > MAX_EDGE_M)) {
    return {
      ok: false,
      reasons: ['implausible-depth'],
      widthM,
      heightM,
      depthM,
      unit: explicitUnit,
      width: widthAmount,
      height: heightAmount,
      depth: depthRaw,
    };
  }

  return {
    ok: true,
    reasons: [],
    width: widthAmount,
    height: heightAmount,
    depth: depthRaw,
    unit: explicitUnit,
    widthM,
    heightM,
    depthM,
    physicalAspect: widthM / heightM,
  };
}

export function formatPhysicalLabel({ width, height, depth, unit }) {
  if (!width || !height || !unit) {
    return null;
  }
  const parts = depth ? [width, height, depth] : [width, height];
  return `${parts.join(' × ')} ${unit}`;
}
