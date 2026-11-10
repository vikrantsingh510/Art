export function canShowArchiveAction(artwork) {
  return Boolean(artwork) && artwork.status !== 'archived';
}
