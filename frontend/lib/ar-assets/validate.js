import { validateGlb, validateUsdz } from '../ar-poc-generate.js';

export const USDZ_REQUIRED_ENTRIES = ['model.usda', 'texture.jpg'];

export function readGlbJson(buffer) {
  const jsonLength = buffer.readUInt32LE(12);
  const json = buffer.slice(20, 20 + jsonLength).toString('utf8').replace(/\0/g, ' ').trim();
  return JSON.parse(json);
}

export function listZipEntryNames(buffer) {
  const names = [];
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    return names;
  }
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = bytes.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      break;
    }
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) {
      break;
    }
    names.push(bytes.slice(nameStart, nameEnd).toString('utf8'));
    offset = nameEnd + extraLength + compressedSize;
  }
  return names;
}

export function glbPlaneMetres(buffer) {
  const json = readGlbJson(buffer);
  const accessor = json.accessors?.[0];
  if (!accessor?.min || !accessor?.max) {
    throw new Error('GLB is missing POSITION min/max.');
  }
  return {
    widthM: accessor.max[0] - accessor.min[0],
    heightM: accessor.max[1] - accessor.min[1],
  };
}

export function assertGlbMatchesPhysical(buffer, physical, epsilon = 0.0001) {
  validateGlb(buffer);
  const plane = glbPlaneMetres(buffer);
  if (Math.abs(plane.widthM - physical.widthM) > epsilon) {
    throw new Error(`GLB width ${plane.widthM} m does not match admin ${physical.widthM} m.`);
  }
  if (Math.abs(plane.heightM - physical.heightM) > epsilon) {
    throw new Error(`GLB height ${plane.heightM} m does not match admin ${physical.heightM} m.`);
  }
  return plane;
}

export function assertUsdzContainer(buffer) {
  validateUsdz(buffer);
  const names = listZipEntryNames(buffer);
  for (const required of USDZ_REQUIRED_ENTRIES) {
    if (!names.includes(required)) {
      throw new Error(`USDZ is missing required entry ${required}.`);
    }
  }
  return names;
}
