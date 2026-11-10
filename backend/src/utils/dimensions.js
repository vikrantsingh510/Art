const UNIT_TO_METRES = {
  mm: 0.001,
  cm: 0.01,
  in: 0.0254,
};

const ALIASES = {
  mm: 'mm',
  millimeter: 'mm',
  millimetre: 'mm',
  millimeters: 'mm',
  millimetres: 'mm',
  cm: 'cm',
  centimeter: 'cm',
  centimetre: 'cm',
  centimeters: 'cm',
  centimetres: 'cm',
  cms: 'cm',
  in: 'in',
  inch: 'in',
  inches: 'in',
  '"': 'in',
};

export function normalizeDimensionUnit(unit) {
  if (unit === undefined || unit === null || String(unit).trim() === '') {
    return null;
  }
  const key = String(unit).trim().toLowerCase();
  return ALIASES[key] || null;
}

export function parsePositiveDimension(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 10_000) {
    return null;
  }
  return number;
}

export function toMetres(value, unit) {
  const amount = parsePositiveDimension(value);
  const normalized = normalizeDimensionUnit(unit) || 'cm';
  if (amount === null) {
    return null;
  }
  return amount * UNIT_TO_METRES[normalized];
}

export function artworkPhysicalSizeMetres(artwork) {
  const unit = artwork?.dimensionUnit;
  const widthM = toMetres(artwork?.width, unit);
  const heightM = toMetres(artwork?.height, unit);
  if (widthM === null || heightM === null) {
    return null;
  }
  return {
    widthM,
    heightM,
    unit: normalizeDimensionUnit(unit) || 'cm',
  };
}

export default {
  normalizeDimensionUnit,
  parsePositiveDimension,
  toMetres,
  artworkPhysicalSizeMetres,
};
