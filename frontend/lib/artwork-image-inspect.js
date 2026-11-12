export const AR_SOURCE_IMAGE_KINDS = ['jpeg', 'png'];
export const LOW_RESOLUTION_MIN_EDGE = 1200;
export const LARGE_FILE_WARN_RATIO = 0.7;

function asBytes(input) {
  if (!input) {
    return new Uint8Array();
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(input)) {
    return new Uint8Array(input);
  }
  return new Uint8Array(input);
}

function readU16(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes, offset) {
  return (
    (bytes[offset] * 0x1000000)
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3]
  ) >>> 0;
}

export function detectImageKind(input) {
  const bytes = asBytes(input);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return 'webp';
  }
  if (
    bytes.length >= 12
    && bytes[4] === 0x66
    && bytes[5] === 0x74
    && bytes[6] === 0x79
    && bytes[7] === 0x70
  ) {
    return 'avif';
  }
  return 'unknown';
}

export function jpegPixelSize(input) {
  const bytes = asBytes(input);
  if (detectImageKind(bytes) !== 'jpeg') {
    return null;
  }
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1];
    const size = readU16(bytes, offset + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        width: readU16(bytes, offset + 7),
        height: readU16(bytes, offset + 5),
      };
    }
    offset += 2 + size;
  }
  return null;
}

export function pngPixelSize(input) {
  const bytes = asBytes(input);
  if (detectImageKind(bytes) !== 'png' || bytes.length < 24) {
    return null;
  }
  return {
    width: readU32(bytes, 16),
    height: readU32(bytes, 20),
  };
}

export function inspectImageBytes(input) {
  const bytes = asBytes(input);
  if (!bytes.length) {
    return {
      ok: false,
      kind: 'unknown',
      mime: null,
      width: null,
      height: null,
      reason: 'empty-file',
    };
  }

  const kind = detectImageKind(bytes);
  const mimeByKind = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
  };
  const pixels = kind === 'jpeg'
    ? jpegPixelSize(bytes)
    : kind === 'png'
      ? pngPixelSize(bytes)
      : null;

  if (kind === 'unknown') {
    return {
      ok: false,
      kind,
      mime: null,
      width: null,
      height: null,
      reason: 'unsupported-or-corrupt',
    };
  }

  if ((kind === 'jpeg' || kind === 'png') && (!pixels || !(pixels.width > 0) || !(pixels.height > 0))) {
    return {
      ok: false,
      kind,
      mime: mimeByKind[kind],
      width: null,
      height: null,
      reason: 'corrupt-image',
    };
  }

  return {
    ok: true,
    kind,
    mime: mimeByKind[kind] || null,
    width: pixels?.width || null,
    height: pixels?.height || null,
    reason: null,
    arSource: AR_SOURCE_IMAGE_KINDS.includes(kind),
  };
}

export function imageInspectionWarnings(inspection, { fileSize = null, fileSizeLimitBytes = null } = {}) {
  const warnings = [];
  if (inspection?.width > 0 && inspection?.height > 0) {
    const shortEdge = Math.min(inspection.width, inspection.height);
    if (shortEdge < LOW_RESOLUTION_MIN_EDGE) {
      warnings.push(
        `Low resolution: ${inspection.width} × ${inspection.height} px. A short edge of at least ${LOW_RESOLUTION_MIN_EDGE} px is recommended for wall-scale AR.`,
      );
    }
  }
  const size = Number(fileSize);
  const limit = Number(fileSizeLimitBytes);
  if (Number.isFinite(size) && Number.isFinite(limit) && limit > 0 && size > limit * LARGE_FILE_WARN_RATIO && size <= limit) {
    warnings.push('This file is unusually large for the artwork-images bucket limit. It can still be uploaded.');
  }
  return warnings;
}

export async function inspectArtworkImageFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    return inspectImageBytes(null);
  }
  const buffer = new Uint8Array(await file.arrayBuffer());
  return inspectImageBytes(buffer);
}
