export function isArtistFeaturedOnHomepage(artistId, featuredArtistId) {
  return Boolean(artistId && featuredArtistId && String(artistId) === String(featuredArtistId));
}

export function homepageFeaturedArtistPutBody({
  artistId,
  featuredArtistId,
  enabled,
} = {}) {
  if (!artistId) {
    return null;
  }

  if (enabled) {
    return { artistId };
  }

  if (isArtistFeaturedOnHomepage(artistId, featuredArtistId)) {
    return { artistId: null };
  }

  return null;
}
