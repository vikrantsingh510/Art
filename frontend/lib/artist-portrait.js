export function artistPortraitStoragePath(artistId, fileName) {
  const ext = String(fileName || 'portrait.jpg')
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
  return `artists/${artistId}/portrait.${mapped[ext] || 'jpg'}`;
}

export function isArtistPortraitPath(artistId, storagePath) {
  return String(storagePath || '').startsWith(`artists/${artistId}/portrait.`);
}
