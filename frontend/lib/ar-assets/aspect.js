import { jpegDimensions } from '../ar-poc-generate.js';
import { compareAspect } from './aspect-compare.js';

export { compareAspect };

export function pngDimensions(buffer) {
  if (!buffer || buffer.length < 24) {
    return null;
  }
  if (buffer[0] !== 0x89 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export function imagePixelSize(buffer) {
  return jpegDimensions(buffer) || pngDimensions(buffer);
}
