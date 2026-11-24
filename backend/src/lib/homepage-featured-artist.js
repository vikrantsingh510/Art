const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readHomepageFeaturedArtistId(value) {
  const raw = value && typeof value === 'object' ? value.artistId : value;
  if (raw == null) {
    return null;
  }
  const artistId = String(raw).trim();
  if (!artistId || !UUID_PATTERN.test(artistId)) {
    return null;
  }
  return artistId.toLowerCase();
}

export function toHomepageFeaturedArtistSnapshot(row) {
  if (!row) {
    return {
      artistId: null,
      updatedAt: null,
    };
  }

  return {
    artistId: readHomepageFeaturedArtistId(row.value),
    updatedAt: row.updatedAt || null,
  };
}

export function toPublicHomepageFeaturedArtist(artist) {
  return {
    artist: artist || null,
  };
}

export default {
  readHomepageFeaturedArtistId,
  toHomepageFeaturedArtistSnapshot,
  toPublicHomepageFeaturedArtist,
};
