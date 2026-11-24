import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  galleryHasControls,
  orderedGalleryImages,
  swipeDirection,
  wrapGalleryIndex,
} from '../lib/artwork-gallery.js';
import { ARTWORK_LIGHTBOX_MS, shouldDeferLightboxExit } from '../lib/artwork-lightbox.js';
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
  persistArtworkDisplayDerivative,
  persistPendingArtworkImage,
  purgeCatalogueImage,
} from '../lib/artwork-image-upload.js';
import { displayDerivativeStoragePath } from '../lib/media.js';

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
  const derivativePath = displayDerivativeStoragePath(storagePath);
  assert.deepEqual(storagePaths, [derivativePath, storagePath, derivativePath, storagePath]);
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

test('admin image manager never treats a display sibling as an original', () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/artwork-image-manager.js'),
    'utf8',
  );
  assert.match(source, /isArtworkDisplayDerivativePath/);
  assert.match(source, /filter\(\(image\) => !isArtworkDisplayDerivativePath\(image\.storagePath\)\)/);
});

test('admin image manager pins DndContext id so sortable aria ids hydrate', () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/artwork-image-manager.js'),
    'utf8',
  );
  assert.match(source, /useId\(\)/);
  assert.match(source, /<DndContext id=\{dndContextId\}/);
});

test('artwork save continues after display derivative generation fails', () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/artwork-form.js'),
    'utf8',
  );
  assert.match(source, /persistArtworkDisplayDerivative/);
  assert.match(source, /createAdminDisplayDerivative/);
  assert.doesNotMatch(source, /from '@\/lib\/artwork-display'/);
});

test('display derivative upload failure does not fail catalogue persistence', async () => {
  const uploads = [];
  const result = await persistArtworkDisplayDerivative({
    originalPath: '33333333-3333-4333-8333-333333333333/file.jpg',
    file: { name: 'file.jpg' },
    storageSession: { accessToken: 'token' },
    createDerivative: async () => {
      throw new Error('sharp failed');
    },
    uploadFile: async (session) => {
      uploads.push(session.path);
      return { status: 200 };
    },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(uploads, []);
});

test('derivative cleanup failure leaves the original Storage object and catalogue row', async () => {
  const storagePaths = [];
  const catalogueCalls = [];
  await assert.rejects(
    () => purgeCatalogueImage({
      storagePath: '33333333-3333-4333-8333-333333333333/file.jpg',
      deleteStorage: async (session) => {
        storagePaths.push(session.path);
        if (String(session.path).endsWith('.display.webp')) {
          throw new Error('derivative locked');
        }
      },
      removeCatalogue: async () => {
        catalogueCalls.push('deleted');
      },
    }),
    (error) => error.code === 'STORAGE_DELETE_FAILED'
      && /catalogue was not changed/.test(error.message)
      && /file\.jpg\.display\.webp/.test(error.message),
  );
  assert.deepEqual(storagePaths, ['33333333-3333-4333-8333-333333333333/file.jpg.display.webp']);
  assert.deepEqual(catalogueCalls, []);
});

test('storefront catalogue images skip the Next optimizer so Storage originals can render', () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/artwork-image.js'),
    'utf8',
  );
  assert.match(source, /unoptimized/);
  assert.match(source, /\/_next\/image/);
  assert.match(source, /artworkStorefrontImageUrl/);
  assert.doesNotMatch(source, /'use client'/);
  assert.doesNotMatch(source, /useState/);
});

test('detail gallery constrains the main artwork to the first viewport without cropping', () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const gallery = fs.readFileSync(path.join(root, '../components/artwork-gallery.js'), 'utf8');
  const image = fs.readFileSync(path.join(root, '../components/artwork-image.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, '../app/globals.css'), 'utf8');
  const page = fs.readFileSync(path.join(root, '../app/(gallery)/artwork/[id]/page.js'), 'utf8');

  assert.match(image, /variant === 'detail' \? 'artwork-detail-frame'/);
  assert.match(image, /object-contain/);
  assert.doesNotMatch(image, /object-cover/);

  const blocks = [...gallery.matchAll(/<ArtworkImage[\s\S]*?\/>/g)].map((match) => match[0]);
  const detailBlocks = blocks.filter((block) => /variant="detail"/.test(block));
  const lightboxBlocks = blocks.filter((block) => /variant="lightbox"/.test(block));
  const thumbBlocks = blocks.filter((block) => /sizes="120px"/.test(block));
  assert.equal(detailBlocks.length, 2);
  assert.equal(lightboxBlocks.length, 1);
  assert.equal(thumbBlocks.length, 1);
  assert.doesNotMatch(thumbBlocks[0], /variant="detail"|variant="lightbox"/);
  assert.doesNotMatch(lightboxBlocks[0], /variant="detail"/);

  assert.match(css, /\.artwork-detail-frame/);
  assert.match(css, /100svh/);
  assert.match(css, /100dvh/);
  assert.match(css, /--artwork-chrome:\s*7\.5rem/);
  assert.match(css, /\.artwork-detail-frame img\s*\{[^}]*object-fit:\s*contain/);
  assert.match(css, /\.artwork-detail-frame img\s*\{[^}]*object-position:\s*center/);
  assert.doesNotMatch(css, /\.artwork-detail-frame img\s*\{[^}]*object-fit:\s*cover/);

  assert.match(page, /md:grid-cols-12/);
  assert.match(page, /md:col-span-7/);
  assert.match(page, /md:col-span-5/);
  assert.match(page, /md:items-start/);
  assert.match(page, /AddToCartButton/);
  assert.match(page, /AddToWishlistButton/);
  assert.match(page, /ArtworkArPanel/);
  assert.match(page, /ArViewer/);
  assert.match(page, /ArtworkGallery/);
});

test('detail artwork max-height leaves the full painting in the first desktop viewport', () => {
  const rem = 16;
  const chrome = 7.5 * rem;
  const desktopGutter = 6.25 * rem;
  const mobileGutter = 5.5 * rem;
  const portraitAspect = 90 / 120;
  const viewports = [
    { width: 1920, height: 1080, gutter: desktopGutter },
    { width: 1440, height: 900, gutter: desktopGutter },
    { width: 1366, height: 768, gutter: desktopGutter },
    { width: 1280, height: 720, gutter: desktopGutter },
    { width: 390, height: 844, gutter: mobileGutter },
  ];

  for (const viewport of viewports) {
    const maxHeight = viewport.height - chrome - viewport.gutter;
    const pageGutter = viewport.width >= 768 ? 128 : 48;
    const columnWidth = viewport.width >= 768
      ? ((viewport.width - pageGutter) * 7) / 12
      : viewport.width - pageGutter;
    const fittedWidth = Math.min(columnWidth, maxHeight * portraitAspect);
    const fittedHeight = fittedWidth / portraitAspect;
    assert.ok(maxHeight > 0, `${viewport.width}x${viewport.height} has a positive stage`);
    assert.ok(fittedHeight <= maxHeight + 0.5, `${viewport.width}x${viewport.height} painting fits the stage`);
    assert.ok(
      fittedHeight <= viewport.height - chrome,
      `${viewport.width}x${viewport.height} painting stays below the header`,
    );
  }
});

test('artwork gallery lightbox fades without changing swipe, keyboard or physical fit', () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const gallery = fs.readFileSync(path.join(root, '../components/artwork-gallery.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, '../app/globals.css'), 'utf8');
  const page = fs.readFileSync(path.join(root, '../app/(gallery)/artwork/[id]/page.js'), 'utf8');

  assert.equal(ARTWORK_LIGHTBOX_MS, 200);
  globalThis.matchMedia = () => ({ matches: false });
  assert.equal(shouldDeferLightboxExit(), true);
  globalThis.matchMedia = () => ({ matches: true });
  assert.equal(shouldDeferLightboxExit(), false);
  delete globalThis.matchMedia;

  assert.match(gallery, /closeLightbox/);
  assert.match(gallery, /openLightbox/);
  assert.match(gallery, /artwork-lightbox-backdrop/);
  assert.match(gallery, /is-exiting/);
  assert.match(gallery, /ARTWORK_LIGHTBOX_MS/);
  assert.match(gallery, /shouldDeferLightboxExit/);
  assert.match(gallery, /swipeDirection/);
  assert.match(gallery, /event\.key === 'ArrowRight'/);
  assert.match(gallery, /event\.key === 'ArrowLeft'/);
  assert.match(gallery, /event\.key === 'Escape'/);
  assert.match(gallery, /artwork-gallery-thumb/);
  assert.match(gallery, /artwork-gallery-stage/);
  assert.match(gallery, /key=\{selected\.id\}/);
  assert.match(gallery, /fit="physical"/);
  assert.match(gallery, /priority/);
  assert.doesNotMatch(gallery, /hover=\{false\}/);
  assert.doesNotMatch(gallery, /setInterval|autoplay/);
  assert.doesNotMatch(gallery, /model-viewer|ArViewer/);
  assert.match(css, /artwork-lightbox-enter 200ms var\(--motion-ease\)/);
  assert.match(css, /\.artwork-lightbox-backdrop\.is-exiting/);
  assert.match(css, /\.artwork-gallery-thumb\.is-active/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.artwork-lightbox-backdrop/);
  assert.match(css, /\.artwork-detail-frame img\s*\{[^}]*object-fit:\s*contain/);
  assert.match(page, /ArtworkGallery/);
  assert.match(page, /ArtworkSizeGuide/);
  assert.match(page, /ArViewer/);
});

test('mobile gallery nav uses compact circular arrows without changing swipe or lightbox', () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const gallery = fs.readFileSync(path.join(root, '../components/artwork-gallery.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, '../app/globals.css'), 'utf8');
  const icons = fs.readFileSync(path.join(root, '../components/icons.js'), 'utf8');

  assert.match(gallery, /from '\.\/icons'/);
  assert.match(gallery, /IconArrow/);
  assert.match(gallery, /aria-label="Previous artwork image"/);
  assert.match(gallery, /aria-label="Next artwork image"/);
  assert.match(gallery, /onClick=\{\(\) => go\(-1\)\}/);
  assert.match(gallery, /onClick=\{\(\) => go\(1\)\}/);
  assert.match(gallery, /artwork-gallery-nav-prev/);
  assert.match(gallery, /artwork-gallery-nav-next/);
  assert.match(gallery, /artwork-gallery-nav-icon/);
  assert.match(gallery, /artwork-gallery-nav-label/);
  assert.match(gallery, /swipeDirection/);
  assert.match(gallery, /event\.key === 'ArrowRight'/);
  assert.match(gallery, /event\.key === 'ArrowLeft'/);
  assert.match(icons, /export function IconArrow/);
  assert.match(css, /\.artwork-gallery-nav \{[\s\S]*border-radius:\s*50%/);
  assert.match(css, /\.artwork-gallery-nav \{[\s\S]*width:\s*2\.5rem/);
  assert.match(css, /\.artwork-gallery-nav \{[\s\S]*height:\s*2\.5rem/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*\.artwork-gallery-nav-label \{[\s\S]*display:\s*none/);
  assert.match(css, /\.artwork-gallery-nav \{[\s\S]*font-size:\s*0/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.artwork-gallery-nav \{[\s\S]*min-height:\s*44px/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.artwork-gallery-nav-icon \{[\s\S]*display:\s*none/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.artwork-gallery-nav-label \{[\s\S]*display:\s*inline/);
  assert.match(css, /@media \(hover: hover\)[\s\S]*\.artwork-gallery-nav:hover/);
  assert.match(css, /\.artwork-gallery-nav:focus-visible/);
  assert.match(gallery, /btn-secondary min-h-11[\s\S]*Previous/);
  assert.match(gallery, /btn-secondary min-h-11[\s\S]*Next/);
  assert.doesNotMatch(gallery, /from 'lucide-react'|from 'react-icons'/);
});
