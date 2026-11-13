import { env } from '../config/env.js';
import {
  AR_ASSET_BUCKETS,
  ARTWORK_IMAGE_BUCKET,
  ARTWORK_MEDIA_BUCKETS,
  ARTWORK_PREVIEW_BUCKET,
  isArtworkOwnedPath,
  ownedImagePaths,
  ownedMediaPaths,
  ownedPreviewPaths,
} from '../lib/artwork-owned-paths.js';

function encodeObjectPath(objectPath) {
  return String(objectPath)
    .split('/')
    .filter((part) => part.length > 0)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function getTrustedStorageCredentials({
  supabaseUrl = env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '',
} = {}) {
  const key = String(serviceRoleKey || '');
  if (!supabaseUrl || !key) {
    return null;
  }
  if (key.startsWith('sb_publishable_') || key.startsWith('NEXT_PUBLIC_')) {
    return null;
  }
  return {
    supabaseUrl: String(supabaseUrl).replace(/\/$/, ''),
    serviceRoleKey: key,
  };
}

export function createTrustedStorageClient({
  bucket,
  credentials,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!credentials?.supabaseUrl || !credentials?.serviceRoleKey || !bucket) {
    return null;
  }

  const headers = {
    Authorization: `Bearer ${credentials.serviceRoleKey}`,
    apikey: credentials.serviceRoleKey,
  };

  return {
    bucket,
    async list(prefix) {
      const cleaned = String(prefix || '').replace(/^\/+|\/+$/g, '');
      const response = await fetchImpl(
        `${credentials.supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prefix: cleaned,
            limit: 1000,
            offset: 0,
          }),
        },
      );
      if (response.status === 404) {
        return [];
      }
      if (!response.ok) {
        throw new Error('list-failed');
      }
      const rows = await response.json();
      if (!Array.isArray(rows)) {
        return [];
      }
      return rows.map((row) => {
        const name = String(row?.name || '').replace(/^\/+/, '');
        if (!name) {
          return null;
        }
        if (!cleaned || name === cleaned || name.startsWith(`${cleaned}/`)) {
          return name;
        }
        return `${cleaned}/${name}`;
      }).filter(Boolean);
    },
    async remove(objectPath) {
      const response = await fetchImpl(
        `${credentials.supabaseUrl}/storage/v1/object/${bucket}/${encodeObjectPath(objectPath)}`,
        {
          method: 'DELETE',
          headers,
        },
      );
      if (response.ok || response.status === 404) {
        return { removed: response.ok };
      }
      throw new Error('remove-failed');
    },
  };
}

async function listOwnedPrefix(storage, artworkId, prefix = artworkId, depth = 0) {
  if (!storage || depth > 8) {
    return [];
  }
  const names = await storage.list(prefix);
  const owned = [];
  for (const name of names) {
    if (!isArtworkOwnedPath(artworkId, name) && name !== artworkId) {
      continue;
    }
    if (isArtworkOwnedPath(artworkId, name)) {
      owned.push(name);
    }
    const leaf = String(name).split('/').pop();
    if (leaf && !/\.[a-z0-9]+$/i.test(leaf)) {
      owned.push(...await listOwnedPrefix(storage, artworkId, name, depth + 1));
    }
  }
  return [...new Set(owned)];
}

async function removeObject(storage, objectPath, warnings, label) {
  try {
    await storage.remove(objectPath);
  } catch {
    warnings.push(`${label} could not be removed.`);
  }
}

export async function cleanupArtworkStorage({
  artworkId,
  images = [],
  media = [],
  previews = [],
  getCredentials = getTrustedStorageCredentials,
  createStorage = createTrustedStorageClient,
} = {}) {
  const warnings = [];
  const credentials = getCredentials();
  if (!credentials) {
    return {
      warnings: ['Storage cleanup skipped: trusted Storage credentials are unavailable.'],
    };
  }

  const objects = [
    ...ownedImagePaths(artworkId, images),
    ...ownedMediaPaths(artworkId, media),
    ...ownedPreviewPaths(artworkId, previews),
  ];

  const skippedImages = images.filter((image) => (
    !ownedImagePaths(artworkId, [image]).length
  ));
  const skippedMedia = media.filter((item) => (
    !ownedMediaPaths(artworkId, [item]).length
  ));
  const skippedPreviews = previews.filter((preview) => (
    !ownedPreviewPaths(artworkId, [preview]).length
  ));
  if (skippedImages.length || skippedMedia.length || skippedPreviews.length) {
    warnings.push('Skipped one or more Storage paths that failed ownership validation.');
  }

  const clients = new Map();
  function storageFor(bucket) {
    if (!clients.has(bucket)) {
      clients.set(bucket, createStorage({ bucket, credentials }));
    }
    return clients.get(bucket);
  }

  for (const object of objects) {
    const storage = storageFor(object.bucket);
    if (!storage) {
      warnings.push(`${object.bucket} cleanup skipped.`);
      continue;
    }
    await removeObject(storage, object.path, warnings, object.bucket);
  }

  for (const bucket of AR_ASSET_BUCKETS) {
    const storage = storageFor(bucket);
    if (!storage) {
      warnings.push(`${bucket} cleanup skipped: trusted Storage credentials are unavailable.`);
      continue;
    }
    try {
      const paths = await listOwnedPrefix(storage, artworkId);
      for (const objectPath of paths) {
        await removeObject(storage, objectPath, warnings, bucket);
      }
    } catch {
      warnings.push(`${bucket} cleanup skipped.`);
    }
  }

  return {
    warnings,
    allowedBuckets: [
      ARTWORK_IMAGE_BUCKET,
      ARTWORK_PREVIEW_BUCKET,
      ...ARTWORK_MEDIA_BUCKETS,
      ...AR_ASSET_BUCKETS,
    ],
  };
}

export default {
  getTrustedStorageCredentials,
  createTrustedStorageClient,
  cleanupArtworkStorage,
};
