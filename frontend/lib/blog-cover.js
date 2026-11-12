export function blogCoverStoragePath(blogId, fileName) {
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
  return `blogs/${blogId}/cover.${mapped[ext] || 'jpg'}`;
}

export function isBlogCoverPath(blogId, storagePath) {
  return String(storagePath || '').startsWith(`blogs/${blogId}/cover.`);
}
