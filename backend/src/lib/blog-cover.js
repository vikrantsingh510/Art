import { ApiError } from '../utils/ApiError.js';

const COVER_PATH = /^blogs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/cover\.(jpe?g|png|webp|avif)$/i;

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

export function assertCoverStoragePathForBlog(blogId, storagePath) {
  const value = String(storagePath || '');
  const expectedPrefix = `blogs/${blogId}/`;
  if (!value.startsWith(expectedPrefix) || value.includes('..') || !COVER_PATH.test(value)) {
    throw new ApiError(400, 'Cover storage path must be blogs/{blogId}/cover.{ext} in artwork-images.');
  }
}

export default {
  blogCoverStoragePath,
  assertCoverStoragePathForBlog,
};
