export const MAX_ARTWORK_IMAGES = 5;

export function sortArtworkImages(images) {
  return [...(images || [])].sort((left, right) => {
    const order = (Number(left.displayOrder) || 0) - (Number(right.displayOrder) || 0);
    if (order !== 0) {
      return order;
    }
    return String(left.id || '').localeCompare(String(right.id || ''));
  });
}

export function remainingImageSlots(savedCount, pendingCount) {
  return Math.max(0, MAX_ARTWORK_IMAGES - Number(savedCount || 0) - Number(pendingCount || 0));
}

export function takeFilesWithinLimit(files, remaining) {
  return Array.from(files || []).slice(0, Math.max(0, remaining));
}

export function moveImageItem(items, fromIndex, toIndex) {
  if (!Array.isArray(items) || fromIndex === toIndex) {
    return items;
  }
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function savedImageKey(id) {
  return `saved:${id}`;
}

export function pendingImageKey(id) {
  return `pending:${id}`;
}

export function isSavedImageKey(key) {
  return String(key || '').startsWith('saved:');
}

export function imageIdFromKey(key) {
  return String(key || '').replace(/^(saved|pending):/, '');
}

export function capacityLabel(savedCount, pendingCount) {
  const used = Number(savedCount || 0) + Number(pendingCount || 0);
  return `${used} of ${MAX_ARTWORK_IMAGES} images`;
}
