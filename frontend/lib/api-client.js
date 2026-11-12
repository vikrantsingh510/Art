export class ApiClientError extends Error {
  constructor(message, { status = 0, details, payload, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
    this.payload = payload;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function parseRetryAfter(value, now = Date.now()) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.ceil(asNumber);
  }
  const asDate = Date.parse(String(value));
  if (Number.isNaN(asDate)) {
    return null;
  }
  return Math.max(0, Math.ceil((asDate - now) / 1000));
}

function headerValue(headers, name) {
  if (!headers) {
    return null;
  }
  if (typeof headers.get === 'function') {
    return headers.get(name);
  }
  const match = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return match ? headers[match] : null;
}

function joinUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function createApiClient({
  baseUrl,
  fetchImpl = globalThis.fetch,
  getAccessToken,
  onUnauthorized,
  timeoutMs = 20_000,
} = {}) {
  async function request(path, { method = 'GET', body, token, query, headers } = {}) {
    const url = new URL(joinUrl(joinUrl(baseUrl, '/api/v1'), path));

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const accessToken = token ?? (typeof getAccessToken === 'function' ? await getAccessToken() : null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const payload = await readBody(response);

      if (response.status === 401 && typeof onUnauthorized === 'function') {
        await onUnauthorized();
      }

      if (!response.ok || payload?.success === false) {
        const retryAfterSeconds = parseRetryAfter(headerValue(response.headers, 'retry-after'));
        const message = payload?.error?.message || `Request failed (${response.status})`;
        throw new ApiClientError(
          response.status === 429 && retryAfterSeconds !== null
            ? `${message}. Retry in ${retryAfterSeconds} seconds.`
            : message,
          {
            status: response.status,
            details: payload?.error?.details,
            payload,
            retryAfterSeconds,
          },
        );
      }

      if (path.startsWith('/health')) {
        return payload;
      }

      return payload?.data;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      if (error?.name === 'AbortError') {
        throw new ApiClientError('The request timed out. Please retry.', { status: 0 });
      }
      throw new ApiClientError(error?.message || 'Network request failed.', { status: 0 });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  };
}

export function createArtApi(options = {}) {
  const client = createApiClient(options);

  return {
    client,
    health: () => client.get('/health'),
    listArtworks: (query, options) => client.get('/artworks', { query, ...options }),
    getArtwork: (id, options) => client.get(`/artworks/${id}`, options),
    listCategories: (options) => client.get('/categories', options),
    listCollections: (options) => client.get('/collections', options),
    getCollection: (id, options) => client.get(`/collections/${id}`, options),
    listBlogs: (query, options) => client.get('/blogs', { query, ...options }),
    getBlog: (slug, options) => client.get(`/blogs/${slug}`, options),
    getMe: (options) => client.get('/auth/me', options),
    updateMe: (body, options) => client.patch('/auth/me', body, options),
    getCart: (options) => client.get('/cart', options),
    addCartItem: (artworkId, options) => client.post('/cart/items', { artworkId }, options),
    removeCartItem: (artworkId, options) => client.delete(`/cart/items/${artworkId}`, options),
    getWishlist: (options) => client.get('/wishlist', options),
    addWishlistItem: (artworkId, options) => client.post('/wishlist/items', { artworkId }, options),
    removeWishlistItem: (artworkId, options) => client.delete(`/wishlist/items/${artworkId}`, options),
    moveWishlistItemToCart: (artworkId, options) => client.post(`/wishlist/items/${artworkId}/move-to-cart`, undefined, options),
    listAddresses: (options) => client.get('/addresses', options),
    createAddress: (body, options) => client.post('/addresses', body, options),
    updateAddress: (id, body, options) => client.patch(`/addresses/${id}`, body, options),
    deleteAddress: (id, options) => client.delete(`/addresses/${id}`, options),
    checkout: (body, options) => client.post('/checkout', body, options),
    listOrders: (options) => client.get('/orders', options),
    getOrder: (id, options) => client.get(`/orders/${id}`, options),
    adminPing: (options) => client.get('/admin/ping', options),
    adminArtworkImageConstraints: (options) => client.get('/admin/storage/artwork-images', options),
    adminMetrics: (query, options) => client.get('/admin/metrics', { query, ...options }),
    adminArtworks: (query, options) => client.get('/admin/artworks', { query, ...options }),
    createArtwork: (body, options) => client.post('/admin/artworks', body, options),
    updateArtwork: (id, body, options) => client.patch(`/admin/artworks/${id}`, body, options),
    archiveArtwork: (id, options) => client.delete(`/admin/artworks/${id}`, options),
    addArtworkImage: (id, body, options) => client.post(`/admin/artworks/${id}/images`, body, options),
    removeArtworkImage: (id, imageId, options) => client.delete(`/admin/artworks/${id}/images/${imageId}`, options),
    reorderArtworkImages: (id, body, options) => client.patch(`/admin/artworks/${id}/images/order`, body, options),
    addArtworkMedia: (id, body, options) => client.post(`/admin/artworks/${id}/media`, body, options),
    adminCategories: (options) => client.get('/admin/categories', options),
    adminCollections: (options) => client.get('/admin/collections', options),
    adminBlogs: (query, options) => client.get('/admin/blogs', { query, ...options }),
    adminBlog: (id, options) => client.get(`/admin/blogs/${id}`, options),
    createBlog: (body, options) => client.post('/admin/blogs', body, options),
    updateBlog: (id, body, options) => client.patch(`/admin/blogs/${id}`, body, options),
    deleteBlog: (id, options) => client.delete(`/admin/blogs/${id}`, options),
    replaceBlogArtworks: (id, artworkIds, options) => client.put(`/admin/blogs/${id}/artworks`, { artworkIds }, options),
    adminCustomers: (query, options) => client.get('/admin/customers', { query, ...options }),
    adminCustomer: (id, options) => client.get(`/admin/customers/${id}`, options),
    adminOrders: (query, options) => client.get('/admin/orders', { query, ...options }),
    adminOrderShipments: (id, options) => client.get(`/admin/orders/${id}/shipments`, options),
  };
}
