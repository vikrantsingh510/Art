import sharp from 'sharp';
import { TEXTURE_JPEG_QUALITY, TEXTURE_MAX_EDGE } from './constants.js';

/**
 * Contain the texture inside maxEdge. Same aspect; no stretch; no content crop
 * beyond uniform downscale of the whole image.
 */
export function containTextureSize(pixelWidth, pixelHeight, maxEdge = TEXTURE_MAX_EDGE) {
  const width = Number(pixelWidth);
  const height = Number(pixelHeight);
  if (!(width > 0) || !(height > 0)) {
    return { width: null, height: null, downscaled: false, maxEdge };
  }
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) {
    return { width, height, downscaled: false, maxEdge };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    downscaled: true,
    maxEdge,
  };
}

/**
 * Decode the source image and re-encode a JPEG contained in maxEdge.
 * Does not write back to the gallery original. Does not stretch or crop.
 */
export async function optimiseTexture(imageBuffer, {
  maxEdge = TEXTURE_MAX_EDGE,
  quality = TEXTURE_JPEG_QUALITY,
} = {}) {
  if (!imageBuffer?.length) {
    throw new Error('missing-image');
  }

  const source = sharp(imageBuffer, { failOn: 'error' });
  const meta = await source.metadata();
  if (!(meta.width > 0) || !(meta.height > 0)) {
    throw new Error('unreadable-image');
  }

  const size = containTextureSize(meta.width, meta.height, maxEdge);
  let pipeline = source;
  if (size.downscaled) {
    pipeline = pipeline.resize(size.width, size.height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const buffer = await pipeline
    .jpeg({
      quality,
      mozjpeg: true,
      chromaSubsampling: '4:2:0',
    })
    .toBuffer();

  const outMeta = await sharp(buffer).metadata();
  const width = outMeta.width;
  const height = outMeta.height;
  if (!(width > 0) || !(height > 0)) {
    throw new Error('unreadable-image');
  }

  const sourceAspect = meta.width / meta.height;
  const outputAspect = width / height;
  if (Math.abs(sourceAspect - outputAspect) / sourceAspect > 0.005) {
    throw new Error('texture-aspect-changed');
  }

  return {
    buffer,
    mimeType: 'image/jpeg',
    sourceWidth: meta.width,
    sourceHeight: meta.height,
    width,
    height,
    downscaled: size.downscaled,
    quality,
    maxEdge,
    sourceBytes: imageBuffer.length,
    embeddedBytes: buffer.length,
    reduced: buffer.length < imageBuffer.length,
  };
}

export function describeTextureProfile(pixels, imageBuffer, processed = null) {
  if (processed) {
    return {
      maxEdge: processed.maxEdge,
      quality: processed.quality,
      sourceWidth: processed.sourceWidth,
      sourceHeight: processed.sourceHeight,
      targetWidth: processed.width,
      targetHeight: processed.height,
      downscaled: processed.downscaled,
      optimised: true,
      sourceBytes: processed.sourceBytes,
      embeddedBytes: processed.embeddedBytes,
      reduced: processed.reduced,
      note: processed.downscaled
        ? `Decoded and re-encoded JPEG at long-edge ${processed.maxEdge} px, quality ${processed.quality}. Gallery original unchanged.`
        : `Re-encoded JPEG at quality ${processed.quality} without enlarging. Gallery original unchanged.`,
    };
  }

  const size = containTextureSize(pixels?.width, pixels?.height);
  const embeddedBytes = imageBuffer ? imageBuffer.length : 0;
  return {
    maxEdge: size.maxEdge,
    quality: TEXTURE_JPEG_QUALITY,
    sourceWidth: pixels?.width ?? null,
    sourceHeight: pixels?.height ?? null,
    targetWidth: size.width,
    targetHeight: size.height,
    downscaled: size.downscaled,
    optimised: false,
    sourceBytes: embeddedBytes,
    embeddedBytes,
    reduced: false,
    note: size.downscaled
      ? 'Source exceeds max edge; texture was not decoded because this artwork is not generating meshes.'
      : 'Source fits inside the max edge; texture was not decoded because this artwork is not generating meshes.',
  };
}
