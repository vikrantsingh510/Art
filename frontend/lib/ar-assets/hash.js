import { createHash } from 'node:crypto';
import {
  GENERATOR_VERSION,
  TEXTURE_JPEG_QUALITY,
  TEXTURE_MAX_EDGE,
  UV_CONVENTION,
} from './constants.js';

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function contentHash({
  imageBuffer,
  width,
  height,
  depth,
  unit,
  generatorVersion = GENERATOR_VERSION,
  uvConvention = UV_CONVENTION,
  textureMaxEdge = TEXTURE_MAX_EDGE,
  textureQuality = TEXTURE_JPEG_QUALITY,
}) {
  const payload = [
    generatorVersion,
    uvConvention,
    `maxEdge=${textureMaxEdge}`,
    `q=${textureQuality}`,
    String(unit),
    String(width),
    String(height),
    depth === undefined || depth === null || depth === '' ? '' : String(depth),
    sha256Hex(imageBuffer),
  ].join('\n');
  return sha256Hex(Buffer.from(payload, 'utf8'));
}
