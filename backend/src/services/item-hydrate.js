import { getArtworkById } from './artwork.service.js';

export async function hydrateCollectionItems(rows) {
  const detailedItems = [];
  for (const item of rows) {
    try {
      const artwork = await getArtworkById(item.artworkId, { publicOnly: false });
      detailedItems.push({
        id: item.id,
        artworkId: item.artworkId,
        createdAt: item.createdAt,
        artwork,
      });
    } catch {
      detailedItems.push({
        id: item.id,
        artworkId: item.artworkId,
        createdAt: item.createdAt,
        artwork: null,
      });
    }
  }
  return detailedItems;
}

export default {
  hydrateCollectionItems,
};
