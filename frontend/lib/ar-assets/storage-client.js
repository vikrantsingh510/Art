import {
  AR_ASSETS_BUCKET,
  AR_ASSETS_STAGING_BUCKET,
  encodeObjectPath,
} from './storage-paths.js';

export class ArStorageError extends Error {
  constructor(message, { status = 0, code = null, path = null } = {}) {
    super(message);
    this.name = 'ArStorageError';
    this.status = status;
    this.code = code;
    this.path = path;
  }
}

function asBuffer(body) {
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === 'string') {
    return Buffer.from(body, 'utf8');
  }
  return Buffer.from(body);
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    return payload?.message || payload?.error || `Storage request failed (${response.status})`;
  } catch {
    return `Storage request failed (${response.status})`;
  }
}

function isMissingObjectMessage(message) {
  return /object not found|not_found|not found/i.test(String(message || ''));
}

export function isMissingStorageObjectError(error) {
  if (!error) {
    return false;
  }
  if (error.status === 404 || error.code === 'not-found') {
    return true;
  }
  return error.status === 400 && isMissingObjectMessage(error.message);
}

export function createMemoryArStorage({
  bucket = AR_ASSETS_BUCKET,
  publicBucket = bucket !== AR_ASSETS_STAGING_BUCKET,
  publicOrigin = `https://example.supabase.co/storage/v1/object/public/${bucket}`,
} = {}) {
  const objects = new Map();
  return {
    bucket,
    objects,
    publicOrigin,
    async getBucket() {
      return { id: bucket, public: publicBucket };
    },
    async upload({ objectPath, body, contentType, upsert = false, cacheControl = null }) {
      if (objects.has(objectPath) && upsert !== true) {
        throw new ArStorageError(`Object already exists: ${objectPath}`, {
          status: 409,
          code: 'already-exists',
          path: objectPath,
        });
      }
      objects.set(objectPath, {
        body: asBuffer(body),
        contentType: contentType || 'application/octet-stream',
        cacheControl,
      });
      return { path: objectPath };
    },
    async download(objectPath) {
      const row = objects.get(objectPath);
      if (!row) {
        throw new ArStorageError(`Object not found: ${objectPath}`, {
          status: 404,
          code: 'not-found',
          path: objectPath,
        });
      }
      return Buffer.from(row.body);
    },
    async head(objectPath) {
      const row = objects.get(objectPath);
      if (!row) {
        return null;
      }
      return {
        size: row.body.length,
        contentType: row.contentType,
        cacheControl: row.cacheControl,
      };
    },
    async list(prefix) {
      const cleaned = String(prefix || '').replace(/^\/+|\/+$/g, '');
      const paths = [];
      for (const key of objects.keys()) {
        if (!cleaned || key === cleaned || key.startsWith(`${cleaned}/`)) {
          paths.push(key);
        }
      }
      return paths;
    },
    async remove(objectPath) {
      if (!objects.has(objectPath)) {
        return { removed: false };
      }
      objects.delete(objectPath);
      return { removed: true };
    },
    publicUrl(objectPath) {
      if (!objectPath) {
        return null;
      }
      return `${String(publicOrigin).replace(/\/$/, '')}/${String(objectPath).replace(/^\/+/, '')}`;
    },
  };
}

export function createSupabaseArStorage({
  supabaseUrl,
  serviceRoleKey,
  bucket = AR_ASSETS_BUCKET,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required for AR asset storage.');
  }
  const base = String(supabaseUrl).replace(/\/$/, '');
  const publicOrigin = `${base}/storage/v1/object/public/${bucket}`;

  function authHeaders(extra = {}) {
    if (!serviceRoleKey) {
      return extra;
    }
    return {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      ...extra,
    };
  }

  return {
    bucket,
    publicOrigin,
    async getBucket() {
      if (!serviceRoleKey) {
        throw new Error('A server-side Supabase service-role key is required to inspect the AR assets bucket.');
      }
      const response = await fetchImpl(`${base}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
        method: 'GET',
        headers: authHeaders(),
      });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new ArStorageError(await readErrorMessage(response), {
          status: response.status,
          code: 'bucket-lookup-failed',
        });
      }
      return response.json();
    },
    async upload({ objectPath, body, contentType, upsert = false, cacheControl = null }) {
      if (!serviceRoleKey) {
        throw new Error('A server-side Supabase service-role key is required to upload AR assets.');
      }
      const buffer = asBuffer(body);
      const headers = authHeaders({
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': upsert ? 'true' : 'false',
        'content-length': String(buffer.length),
      });
      if (cacheControl) {
        headers['cache-control'] = cacheControl;
      }
      const response = await fetchImpl(
        `${base}/storage/v1/object/${bucket}/${encodeObjectPath(objectPath)}`,
        {
          method: 'POST',
          headers,
          body: buffer,
        },
      );
      if (response.status === 409 || response.status === 400) {
        const message = await readErrorMessage(response);
        const duplicate = response.status === 409
          || /already exists|duplicate|resource already/i.test(message);
        if (duplicate) {
          throw new ArStorageError(message, {
            status: 409,
            code: 'already-exists',
            path: objectPath,
          });
        }
        throw new ArStorageError(message, { status: response.status, path: objectPath });
      }
      if (!response.ok) {
        throw new ArStorageError(await readErrorMessage(response), {
          status: response.status,
          path: objectPath,
        });
      }
      return { path: objectPath };
    },
    async download(objectPath) {
      const headers = serviceRoleKey ? authHeaders() : {};
      const url = serviceRoleKey
        ? `${base}/storage/v1/object/${bucket}/${encodeObjectPath(objectPath)}`
        : `${publicOrigin}/${encodeObjectPath(objectPath)}`;
      const response = await fetchImpl(url, { method: 'GET', headers });
      if (response.status === 404) {
        throw new ArStorageError(`Object not found: ${objectPath}`, {
          status: 404,
          code: 'not-found',
          path: objectPath,
        });
      }
      if (!response.ok) {
        const message = await readErrorMessage(response);
        // Supabase Storage often returns HTTP 400 "Object not found" for a
        // missing key instead of 404. First-time current.json reads depend on this.
        if (response.status === 400 && isMissingObjectMessage(message)) {
          throw new ArStorageError(`Object not found: ${objectPath}`, {
            status: 404,
            code: 'not-found',
            path: objectPath,
          });
        }
        throw new ArStorageError(message, {
          status: response.status,
          path: objectPath,
        });
      }
      return Buffer.from(await response.arrayBuffer());
    },
    async head(objectPath) {
      const headers = serviceRoleKey ? authHeaders() : {};
      const url = serviceRoleKey
        ? `${base}/storage/v1/object/${bucket}/${encodeObjectPath(objectPath)}`
        : `${publicOrigin}/${encodeObjectPath(objectPath)}`;
      const response = await fetchImpl(url, { method: 'HEAD', headers });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        return null;
      }
      const sizeHeader = response.headers.get('content-length');
      return {
        size: sizeHeader ? Number(sizeHeader) : null,
        contentType: response.headers.get('content-type'),
      };
    },
    publicUrl(objectPath) {
      if (!objectPath) {
        return null;
      }
      return `${publicOrigin}/${String(objectPath).replace(/^\/+/, '')}`;
    },
    async list(prefix) {
      if (!serviceRoleKey) {
        throw new Error('A server-side Supabase service-role key is required to list AR objects.');
      }
      const cleaned = String(prefix || '').replace(/^\/+|\/+$/g, '');
      const response = await fetchImpl(`${base}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          prefix: cleaned,
          limit: 1000,
          offset: 0,
        }),
      });
      if (!response.ok) {
        throw new ArStorageError(await readErrorMessage(response), {
          status: response.status,
          code: 'list-failed',
        });
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
      if (!serviceRoleKey) {
        throw new Error('A server-side Supabase service-role key is required to delete AR objects.');
      }
      const response = await fetchImpl(
        `${base}/storage/v1/object/${bucket}/${encodeObjectPath(objectPath)}`,
        {
          method: 'DELETE',
          headers: authHeaders(),
        },
      );
      if (response.status === 404) {
        return { removed: false };
      }
      if (!response.ok) {
        const message = await readErrorMessage(response);
        if (response.status === 400 && isMissingObjectMessage(message)) {
          return { removed: false };
        }
        throw new ArStorageError(message, {
          status: response.status,
          path: objectPath,
        });
      }
      return { removed: true };
    },
  };
}
