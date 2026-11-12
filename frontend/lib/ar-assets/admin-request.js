import { getApiBaseUrl } from '../env.js';

export async function requireAdminApiUser(request, fetchImpl = globalThis.fetch) {
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return { ok: false, status: 401, message: 'Authentication required.' };
  }
  const response = await fetchImpl(`${getApiBaseUrl()}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (response.status === 401) {
    return { ok: false, status: 401, message: 'Authentication required.' };
  }
  if (response.status === 403) {
    return { ok: false, status: 403, message: 'Administrator access is required.' };
  }
  if (!response.ok) {
    return { ok: false, status: 503, message: 'The identity service is unavailable.' };
  }
  const payload = await response.json();
  const user = payload?.data || payload;
  if (!user?.isAdmin) {
    return { ok: false, status: 403, message: 'Administrator access is required.' };
  }
  return { ok: true, token, user };
}

export async function loadAdminArtwork(artworkId, token, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`${getApiBaseUrl()}/api/v1/artworks/${artworkId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (response.status === 404) {
    return { ok: false, status: 404, message: 'Artwork was not found.' };
  }
  if (!response.ok) {
    return { ok: false, status: 503, message: 'The artwork catalogue is unavailable.' };
  }
  const payload = await response.json();
  return { ok: true, artwork: payload?.data || payload };
}
