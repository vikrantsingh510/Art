export function collectionCoverStoragePath(collectionId, fileName) {
  const ext = String(fileName || 'cover.jpg')
    .split('.')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const mapped = {
    jpg: 'jpg',
    jpeg: 'jpg',
    png: 'png',
    webp: 'webp',
    avif: 'avif',
  };
  return `collections/${collectionId}/cover.${mapped[ext] || 'jpg'}`;
}

export function isCollectionCoverPath(collectionId, storagePath) {
  return String(storagePath || '').startsWith(`collections/${collectionId}/cover.`);
}
