const rememberedFavourites = new Map();

export function normalizeArtworkId(value) {
  return String(value || '').trim().toLowerCase();
}

export function wishlistItemsFrom(wishlist) {
  if (Array.isArray(wishlist?.items)) {
    return wishlist.items;
  }
  if (Array.isArray(wishlist)) {
    return wishlist;
  }
  if (Array.isArray(wishlist?.data?.items)) {
    return wishlist.data.items;
  }
  return [];
}

export function isArtworkInWishlist(wishlist, artworkId) {
  const id = normalizeArtworkId(artworkId);
  if (!id) {
    return false;
  }

  return wishlistItemsFrom(wishlist).some((item) => {
    const candidates = [
      item?.artworkId,
      item?.artwork_id,
      item?.artwork?.id,
      item?.artwork?.artworkId,
    ];
    return candidates.some((candidate) => normalizeArtworkId(candidate) === id);
  });
}

export function rememberArtworkFavourite(artworkId, saved) {
  const id = normalizeArtworkId(artworkId);
  if (!id) {
    return;
  }
  rememberedFavourites.set(id, Boolean(saved));
}

export function rememberedArtworkFavourite(artworkId) {
  const id = normalizeArtworkId(artworkId);
  if (!id || !rememberedFavourites.has(id)) {
    return undefined;
  }
  return rememberedFavourites.get(id);
}

export function resolveArtworkFavouriteSaved(artworkId, serverSaved) {
  const remembered = rememberedArtworkFavourite(artworkId);
  if (remembered !== undefined) {
    return remembered;
  }
  return Boolean(serverSaved);
}

export function wishlistFavouriteLabel(saved) {
  return saved ? 'Remove from wishlist' : 'Save to wishlist';
}

export function isWishlistRemoveNotFound(error) {
  return Boolean(error && Number(error.status) === 404);
}

export function wishlistLoginPath(pathname) {
  const next = String(pathname || '').trim() || '/';
  return `/auth/login?next=${encodeURIComponent(next)}`;
}
