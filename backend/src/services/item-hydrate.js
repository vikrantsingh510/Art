import { getArtworksByIds } from './artwork.service.js';

export async function hydrateCollectionItems(rows, {
  loadArtworksByIds = getArtworksByIds,
} = {}) {
  const items = Array.isArray(rows) ? rows : [];
  const artworksById = await loadArtworksByIds(
    items.map((item) => item.artworkId),
    { publicOnly: false },
  );

  return items.map((item) => ({
    id: item.id,
    artworkId: item.artworkId,
    createdAt: item.createdAt,
    artwork: artworksById.get(item.artworkId) || null,
  }));
}

export default {
  hydrateCollectionItems,
};
