export function selectHomepageArtworks(featuredItems, latestItems, { limit = 8 } = {}) {
  const selected = [];
  const seen = new Set();

  for (const artwork of [...(featuredItems || []), ...(latestItems || [])]) {
    if (!artwork?.id || seen.has(artwork.id)) {
      continue;
    }
    seen.add(artwork.id);
    selected.push(artwork);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}
