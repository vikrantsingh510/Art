export const ARTWORK_IMAGES_BUCKET = 'artwork-images';

export function formatFileBytes(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) < 0) {
    return 'unknown size';
  }
  const value = Number(bytes);
  if (value < 1024) {
    return `${value} bytes`;
  }
  const kib = value / 1024;
  if (kib < 1024) {
    return `${formatDecimal(kib)} KB`;
  }
  return `${formatDecimal(kib / 1024)} MB`;
}

function formatDecimal(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function acceptAttributeFromConstraints(constraints) {
  const types = constraints?.allowedMimeTypes;
  if (!Array.isArray(types) || types.length === 0) {
    return undefined;
  }
  return types.join(',');
}

export function isSelectedImageFile(file) {
  return Boolean(file && file.name);
}

export function validateArtworkImageFile(file, constraints) {
  if (!isSelectedImageFile(file)) {
    return { ok: true };
  }

  if (!constraints || constraints.bucket !== ARTWORK_IMAGES_BUCKET) {
    return {
      ok: false,
      code: 'constraints_unavailable',
      message: 'Upload limits could not be loaded from the artwork-images bucket. The file was not sent.',
    };
  }

  const allowed = Array.isArray(constraints.allowedMimeTypes)
    ? constraints.allowedMimeTypes.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
    : [];

  if (allowed.length > 0) {
    const mime = String(file.type || '').trim().toLowerCase();
    if (!allowed.includes(mime)) {
      return {
        ok: false,
        code: 'mime',
        message: `This file type is not allowed. The artwork-images bucket accepts: ${allowed.join(', ')}.`,
      };
    }
  }

  const rawLimit = constraints.fileSizeLimitBytes;
  const limit = rawLimit === null || rawLimit === undefined || rawLimit === ''
    ? null
    : Number(rawLimit);
  if (limit !== null && Number.isFinite(limit) && limit >= 0 && file.size > limit) {
    return {
      ok: false,
      code: 'size',
      message: `This file is ${formatFileBytes(file.size)}. The artwork-images bucket allows up to ${formatFileBytes(limit)}.`,
    };
  }

  return { ok: true };
}

export function explainStorageUploadError(error) {
  const message = error?.message || String(error || 'Upload failed');
  return `Artwork saved. Storage rejected the file: ${message}. The artwork-images bucket remains the authority for size and type.`;
}

export default {
  ARTWORK_IMAGES_BUCKET,
  formatFileBytes,
  acceptAttributeFromConstraints,
  validateArtworkImageFile,
  explainStorageUploadError,
};
