import assert from 'node:assert/strict';
import test from 'node:test';
import {
  galleryHasControls,
  orderedGalleryImages,
  swipeDirection,
  wrapGalleryIndex,
} from '../lib/artwork-gallery.js';
import {
  MAX_ARTWORK_IMAGES,
  capacityLabel,
  moveImageItem,
  pendingImageKey,
  remainingImageSlots,
  savedImageKey,
  sortArtworkImages,
  takeFilesWithinLimit,
} from '../lib/artwork-image-queue.js';
import {
  deleteArtworkImageFile,
  explainImagePersistError,
  persistPendingArtworkImage,
  purgeCatalogueImage,
} from '../lib/artwork-image-upload.js';

test('image queue never admits a sixth file', () => {
  assert.equal(MAX_ARTWORK_IMAGES, 5);
  assert.equal(remainingImageSlots(5, 0), 0);
  assert.equal(remainingImageSlots(3, 1), 1);
  assert.equal(takeFilesWithinLimit(['a', 'b', 'c'], 2).length, 2);
  assert.equal(capacityLabel(2, 1), '3 of 5 images');
});

test('pending images can be removed and remaining items reordered', () => {
  const items = [
    { key: savedImageKey('a') },
    { key: pendingImageKey('b') },
    { key: savedImageKey('c') },
  ];
  const withoutPending = items.filter((item) => item.key !== pendingImageKey('b'));
  assert.equal(withoutPending.length, 2);
  assert.deepEqual(
    moveImageItem(withoutPending, 0, 1).map((item) => item.key),
    [savedImageKey('c'), savedImageKey('a')],
  );
});

test('gallery helpers cap a hanging at five images', () => {
  const images = [0, 1, 2, 3, 4, 5].map((order) => ({ id: String(order), displayOrder: order }));
  assert.equal(orderedGalleryImages({ images }).length, 5);
  assert.deepEqual(orderedGalleryImages({ images }).map((image) => image.id), ['0', '1', '2', '3', '4']);
});

test('gallery helpers order images, wrap navigation and hide controls for a single image', () => {
  const artwork = {
    images: [
      { id: '2', displayOrder: 2, isPrimary: false, storagePath: 'lot/two.jpg' },
      { id: '1', displayOrder: 0, isPrimary: true, storagePath: 'lot/one.jpg' },
    ],
  };
  assert.deepEqual(orderedGalleryImages(artwork).map((image) => image.id), ['1', '2']);
  assert.equal(galleryHasControls(orderedGalleryImages(artwork)), true);
  assert.equal(galleryHasControls([{ id: '1' }]), false);
  assert.equal(wrapGalleryIndex(2, 2), 0);
  assert.equal(wrapGalleryIndex(-1, 2), 1);
  assert.equal(swipeDirection(-50), 'next');
  assert.equal(swipeDirection(50), 'previous');
  assert.equal(swipeDirection(10), null);
});

test('sort prefers display order then id for a five-image hanging', () => {
  const images = [4, 1, 5, 2, 3].map((order) => ({ id: String(order), displayOrder: order }));
  assert.deepEqual(sortArtworkImages(images).map((image) => image.id), ['1', '2', '3', '4', '5']);
});

async function storageResponse(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('storage delete treats missing objects as already removed', async () => {
  const calls = [];
  const result = await deleteArtworkImageFile({
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_test',
    accessToken: 'token',
    path: 'lot/file.jpg',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: false, status: 404, json: async () => ({}) };
    },
  });
  assert.equal(result.status, 404);
  assert.match(calls[0].url, /\/storage\/v1\/object\/artwork-images\/lot\/file.jpg$/);
  assert.equal(calls[0].options.method, 'DELETE');
});

test('storage authorization, server and network errors are not treated as already deleted', async () => {
  const session = {
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_test',
    accessToken: 'token',
    path: 'lot/file.jpg',
  };
  await assert.rejects(
    () => deleteArtworkImageFile({
      ...session,
      fetchImpl: async () => storageResponse(401, { message: 'Invalid JWT' }),
    }),
    /Invalid JWT/,
  );
  await assert.rejects(
    () => deleteArtworkImageFile({
      ...session,
      fetchImpl: async () => storageResponse(403, { message: 'Unauthorized' }),
    }),
    /Unauthorized/,
  );
  await assert.rejects(
    () => deleteArtworkImageFile({
      ...session,
      fetchImpl: async () => storageResponse(500, { message: 'Internal server error' }),
    }),
    /Internal server error/,
  );
  await assert.rejects(
    () => deleteArtworkImageFile({
      ...session,
      fetchImpl: async () => {
        throw new Error('network down');
      },
    }),
    /network down/,
  );
});

test('catalogue row is kept when Storage authorization or network delete fails', async () => {
  for (const reason of ['Invalid JWT', 'network down']) {
    const catalogueCalls = [];
    await assert.rejects(
      () => purgeCatalogueImage({
        storagePath: 'lot/file.jpg',
        deleteStorage: async () => {
          throw new Error(reason);
        },
        removeCatalogue: async () => {
          catalogueCalls.push('deleted');
          return { removedId: 'image-id' };
        },
      }),
      (error) => error.code === 'STORAGE_DELETE_FAILED' && /catalogue was not changed/.test(error.message),
    );
    assert.deepEqual(catalogueCalls, []);
  }
});

test('retry uses the same image id and storage path after catalogue delete fails', async () => {
  const imageId = '44444444-4444-4444-8444-444444444444';
  const storagePath = '33333333-3333-4333-8333-333333333333/file.jpg';
  const storagePaths = [];
  const catalogueCalls = [];

  await assert.rejects(
    () => purgeCatalogueImage({
      storagePath,
      deleteStorage: async (session) => {
        storagePaths.push(session.path);
      },
      removeCatalogue: async () => {
        catalogueCalls.push({ imageId, storagePath });
        throw new Error('database timeout');
      },
    }),
    (error) => error.code === 'CATALOGUE_DELETE_FAILED'
      && error.storageDeleted === true
      && error.message.includes(storagePath),
  );

  const result = await purgeCatalogueImage({
    storagePath,
    deleteStorage: async (session) => {
      storagePaths.push(session.path);
    },
    removeCatalogue: async () => {
      catalogueCalls.push({ imageId, storagePath });
      return { removedId: imageId, storagePath };
    },
  });

  assert.equal(result.removedId, imageId);
  assert.equal(result.storagePath, storagePath);
  assert.deepEqual(storagePaths, [storagePath, storagePath]);
  assert.deepEqual(catalogueCalls, [
    { imageId, storagePath },
    { imageId, storagePath },
  ]);
});

test('partial deletion failures keep their own messages instead of an upload phrase', () => {
  assert.match(
    explainImagePersistError({ code: 'STORAGE_DELETE_FAILED', message: 'Storage still holds lot/file.jpg. The catalogue was not changed.' }),
    /catalogue was not changed/,
  );
  assert.doesNotMatch(
    explainImagePersistError({ code: 'CATALOGUE_DELETE_FAILED', message: 'Storage object removed, but the catalogue row remains for lot/file.jpg.' }),
    /Artwork saved/,
  );
  assert.match(
    explainImagePersistError(new Error('bucket policy denied')),
    /Artwork saved\. Storage rejected the file/,
  );
});

const pendingImageSession = {
  artworkId: '33333333-3333-4333-8333-333333333333',
  path: '33333333-3333-4333-8333-333333333333/file.jpg',
  file: { name: 'file.jpg', type: 'image/jpeg', size: 2048 },
  storageSession: {
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_test',
    accessToken: 'user-jwt',
  },
};

test('storage upload failure is not treated as catalogue registration failure', async () => {
  const registerCalls = [];
  const cleanupCalls = [];
  await assert.rejects(
    () => persistPendingArtworkImage({
      ...pendingImageSession,
      uploadFile: async () => {
        throw new Error('bucket policy denied');
      },
      registerCatalogue: async () => {
        registerCalls.push('registered');
        return { id: 'image-id' };
      },
      deleteStorage: async (session) => {
        cleanupCalls.push(session.path);
      },
    }),
    (error) => {
      assert.equal(error.code, 'STORAGE_UPLOAD_FAILED');
      assert.equal(error.message, 'bucket policy denied');
      assert.match(explainImagePersistError(error), /Artwork saved\. Storage rejected the file/);
      assert.doesNotMatch(explainImagePersistError(error), /catalogue registration failed/);
      return true;
    },
  );
  assert.deepEqual(registerCalls, []);
  assert.deepEqual(cleanupCalls, [pendingImageSession.path]);
});

test('successful storage upload and catalogue registration skip cleanup', async () => {
  const cleanupCalls = [];
  const result = await persistPendingArtworkImage({
    ...pendingImageSession,
    uploadFile: async () => ({ status: 200 }),
    registerCatalogue: async () => ({ id: 'image-id', storagePath: pendingImageSession.path }),
    deleteStorage: async (session) => {
      cleanupCalls.push(session.path);
    },
  });
  assert.equal(result.id, 'image-id');
  assert.equal(result.storagePath, pendingImageSession.path);
  assert.deepEqual(cleanupCalls, []);
});

test('catalogue registration failure after upload is not reported as a storage rejection', async () => {
  const registerError = new Error('artwork image capacity exceeded');
  await assert.rejects(
    () => persistPendingArtworkImage({
      ...pendingImageSession,
      uploadFile: async () => ({ status: 200 }),
      registerCatalogue: async () => {
        throw registerError;
      },
      deleteStorage: async () => ({ status: 200 }),
    }),
    (failure) => {
      assert.equal(failure.code, 'REGISTER_AFTER_UPLOAD_FAILED');
      assert.equal(failure.cause, registerError);
      assert.equal(failure.storageDeleted, true);
      assert.equal(failure.artworkId, pendingImageSession.artworkId);
      assert.equal(failure.storagePath, pendingImageSession.path);
      assert.match(failure.message, /Image uploaded, but catalogue registration failed/);
      assert.match(failure.message, /Cleanup was attempted/);
      assert.match(failure.message, /uploaded object was cleaned up/);
      assert.match(failure.message, /artwork image capacity exceeded/);
      assert.doesNotMatch(explainImagePersistError(failure), /Storage rejected the file/);
      return true;
    },
  );
});

test('catalogue registration failure keeps the original error when cleanup succeeds', async () => {
  const registerError = new Error('database timeout');
  await assert.rejects(
    () => persistPendingArtworkImage({
      ...pendingImageSession,
      uploadFile: async () => ({ status: 200 }),
      registerCatalogue: async () => {
        throw registerError;
      },
      deleteStorage: async () => ({ status: 404 }),
    }),
    (failure) => {
      assert.equal(failure.code, 'REGISTER_AFTER_UPLOAD_FAILED');
      assert.equal(failure.cause, registerError);
      assert.equal(failure.storageDeleted, true);
      assert.match(explainImagePersistError(failure), /catalogue registration failed/);
      assert.match(explainImagePersistError(failure), /uploaded object was cleaned up/);
      assert.match(explainImagePersistError(failure), /database timeout/);
      return true;
    },
  );
});

test('catalogue registration failure surfaces cleanup failure with artwork id and path', async () => {
  const registerError = new Error('database timeout');
  const cleanupError = new Error('Invalid JWT');
  await assert.rejects(
    () => persistPendingArtworkImage({
      ...pendingImageSession,
      uploadFile: async () => ({ status: 200 }),
      registerCatalogue: async () => {
        throw registerError;
      },
      deleteStorage: async () => {
        throw cleanupError;
      },
    }),
    (failure) => {
      assert.equal(failure.code, 'REGISTER_CLEANUP_FAILED');
      assert.equal(failure.cause, registerError);
      assert.equal(failure.cleanupError, cleanupError);
      assert.equal(failure.storageDeleted, false);
      assert.equal(failure.artworkId, pendingImageSession.artworkId);
      assert.equal(failure.storagePath, pendingImageSession.path);
      assert.match(failure.message, /could not be cleaned up/);
      assert.match(failure.message, /Manual retry or cleanup is required/);
      assert.match(failure.message, new RegExp(pendingImageSession.artworkId));
      assert.match(failure.message, /33333333-3333-4333-8333-333333333333\/file\.jpg/);
      assert.match(failure.message, /database timeout/);
      assert.match(failure.message, /Invalid JWT/);
      assert.doesNotMatch(explainImagePersistError(failure), /Storage rejected the file/);
      return true;
    },
  );
});
