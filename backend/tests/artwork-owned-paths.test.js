import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  displayDerivativePath,
  isArtworkOwnedPath,
  ownedImagePaths,
  ownedMediaPaths,
  ownedPreviewPaths,
} from '../src/lib/artwork-owned-paths.js';

const artworkId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

test('unsafe paths are skipped', () => {
  assert.equal(isArtworkOwnedPath(artworkId, `../${artworkId}/secret.jpg`), false);
  assert.equal(isArtworkOwnedPath(artworkId, `https://cdn.example/${artworkId}/file.jpg`), false);
  assert.equal(isArtworkOwnedPath(artworkId, `${artworkId}\\escape.jpg`), false);
  assert.equal(isArtworkOwnedPath(artworkId, `${artworkId}`), false);
  assert.equal(displayDerivativePath(`${artworkId}/../x.jpg`), null);
});

test('other artwork prefixes are never treated as owned', () => {
  assert.equal(isArtworkOwnedPath(artworkId, `${otherId}/file.jpg`), false);
  assert.deepEqual(ownedImagePaths(artworkId, [{ storagePath: `${otherId}/file.jpg` }]), []);
  assert.deepEqual(ownedMediaPaths(artworkId, [{
    storageBucket: 'artwork-documents',
    storagePath: `${otherId}/cert.pdf`,
  }]), []);
  assert.deepEqual(ownedPreviewPaths(artworkId, [{ storagePath: `${otherId}/room.jpg` }]), []);
});

test('owned image paths include display derivatives', () => {
  const paths = ownedImagePaths(artworkId, [{ storagePath: `${artworkId}/hero.jpg` }]);
  assert.deepEqual(paths.map((item) => item.path), [
    `${artworkId}/hero.jpg`,
    `${artworkId}/hero.jpg.display.webp`,
  ]);
});

test('media outside allowed buckets is skipped', () => {
  assert.deepEqual(ownedMediaPaths(artworkId, [{
    storageBucket: 'artwork-images',
    storagePath: `${artworkId}/video.mp4`,
  }]), []);
  assert.equal(ownedMediaPaths(artworkId, [{
    storageBucket: 'artwork-videos',
    storagePath: `${artworkId}/clip.mp4`,
  }]).length, 1);
});
