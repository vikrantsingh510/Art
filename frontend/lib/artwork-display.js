import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  displayDerivativeStoragePath,
  isArtworkDisplayDerivativePath,
  isSafeArtworkDisplayPath,
  publicStorageUrl,
} from './media.js';

export { displayDerivativeStoragePath, isArtworkDisplayDerivativePath } from './media.js';

export const DISPLAY_MAX_EDGE = 1600;
export const DISPLAY_QUALITY = 78;
export const DISPLAY_FETCH_TIMEOUT_MS = 20_000;
export const DISPLAY_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function cacheFileFor(storagePath) {
  const digest = createHash('sha256').update(String(storagePath)).digest('hex');
  return path.join(os.tmpdir(), 'maison-art-display', `${digest}.webp`);
}

export async function createArtworkDisplayDerivative(buffer) {
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: DISPLAY_MAX_EDGE,
      height: DISPLAY_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: DISPLAY_QUALITY, effort: 4 })
    .toBuffer();
}

export async function loadArtworkDisplayDerivative(storagePath, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DISPLAY_FETCH_TIMEOUT_MS,
} = {}) {
  const cleanPath = String(storagePath || '').replace(/^\/+/, '');
  if (!isSafeArtworkDisplayPath(cleanPath) || isArtworkDisplayDerivativePath(cleanPath)) {
    return { ok: false, status: 404 };
  }

  const originalUrl = publicStorageUrl(cleanPath);
  if (!originalUrl) {
    return { ok: false, status: 404 };
  }

  const cacheFile = cacheFileFor(cleanPath);
  try {
    const cached = await readFile(cacheFile);
    if (cached?.length) {
      return { ok: true, buffer: cached, cacheHit: true, source: 'cache' };
    }
  } catch {
    // Generate on first request.
  }

  const siblingPath = displayDerivativeStoragePath(cleanPath);
  const siblingUrl = siblingPath ? publicStorageUrl(siblingPath) : null;
  if (siblingUrl) {
    try {
      const sibling = await fetchImpl(siblingUrl, { cache: 'no-store' });
      if (sibling.ok) {
        const buffer = Buffer.from(await sibling.arrayBuffer());
        if (buffer.length) {
          try {
            await mkdir(path.dirname(cacheFile), { recursive: true });
            await writeFile(cacheFile, buffer);
          } catch {
            // Serve even if the process cache cannot be written.
          }
          return { ok: true, buffer, cacheHit: false, source: 'sibling' };
        }
      }
    } catch {
      // Fall back to on-demand generation for lots without a sibling.
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let original;
  try {
    const response = await fetchImpl(originalUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, status: response.status === 404 ? 404 : 502 };
    }
    original = Buffer.from(await response.arrayBuffer());
  } catch {
    return { ok: false, status: 502 };
  } finally {
    clearTimeout(timer);
  }

  if (!original?.length) {
    return { ok: false, status: 404 };
  }

  try {
    const buffer = await createArtworkDisplayDerivative(original);
    try {
      await mkdir(path.dirname(cacheFile), { recursive: true });
      await writeFile(cacheFile, buffer);
    } catch {
      // Serve the derivative even if the local cache cannot be written.
    }
    return { ok: true, buffer, cacheHit: false, source: 'generated' };
  } catch {
    return { ok: false, status: 502 };
  }
}
