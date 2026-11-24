import { cache } from 'react';
import { api } from './api';
import { emptyPublicHomepageFaq, resolveHomepageFaq } from './homepage-faq';
import { resolveHomepageHero } from './homepage-hero';
import { getAccessToken } from './session';
import { isArtworkInWishlist } from './wishlist-favourite';

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

export async function loadArtworkFavouriteSaved(artworkId) {
  try {
    const wishlist = await loadWishlist();
    return isArtworkInWishlist(wishlist, artworkId);
  } catch {
    return false;
  }
}

export const loadWhatsappEnquiry = cache(async function loadWhatsappEnquiry() {
  try {
    const enquiry = await api.getWhatsappEnquiry();
    if (enquiry && typeof enquiry === 'object') {
      return enquiry;
    }
    return { enabled: false };
  } catch {
    return { enabled: false };
  }
});

export const loadHomepageHero = cache(async function loadHomepageHero() {
  try {
    const hero = await api.getHomepageHero();
    if (hero && typeof hero === 'object') {
      return resolveHomepageHero(hero);
    }
    return resolveHomepageHero(null);
  } catch {
    return resolveHomepageHero(null);
  }
});

export const loadHomepageFeaturedArtist = cache(async function loadHomepageFeaturedArtist() {
  try {
    const data = await api.getHomepageFeaturedArtist();
    return data?.artist || null;
  } catch {
    return null;
  }
});

export const loadHomepageFaq = cache(async function loadHomepageFaq() {
  try {
    const data = await api.getHomepageFaq();
    return resolveHomepageFaq(data);
  } catch {
    return emptyPublicHomepageFaq();
  }
});
