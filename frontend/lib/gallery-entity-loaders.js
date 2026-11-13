import { cache } from 'react';
import { api } from './api';
import { getAccessToken } from './session';

/**
 * Request-scoped entity loaders. React.cache deduplicates generateMetadata
 * and page rendering within a single request. It does not cache across requests.
 */
export const loadArtworkById = cache(async function loadArtworkById(id) {
  const token = await getAccessToken();
  return api.getArtwork(id, { token });
});

export const loadArtistBySlug = cache(async function loadArtistBySlug(slug) {
  return api.getArtist(slug);
});

export const loadCollectionById = cache(async function loadCollectionById(id) {
  return api.getCollection(id);
});

export const loadBlogBySlug = cache(async function loadBlogBySlug(slug) {
  return api.getBlog(slug);
});

export const loadCart = cache(async function loadCart() {
  const token = await getAccessToken();
  if (!token) {
    return { id: null, items: [], count: 0 };
  }
  return api.getCart({ token });
});

export const loadWishlist = cache(async function loadWishlist() {
  const token = await getAccessToken();
  if (!token) {
    return { id: null, items: [], count: 0 };
  }
  return api.getWishlist({ token });
});
