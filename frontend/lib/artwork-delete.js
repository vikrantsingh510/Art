export function artworkPermanentDeleteConfirm({ title, id } = {}) {
  return [
    `Permanently delete "${title}" (${id})?`,
    'This cannot be undone. Catalogue images, media, cart/wishlist lines and artwork-specific AR files may be removed.',
    'Works that appear on an order or reservation cannot be deleted. Archive them instead.',
  ].join('\n');
}
