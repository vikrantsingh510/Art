import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ARTWORK_IMAGES_BUCKET } from '../lib/artwork-image-constraints.js';
import {
  HOMEPAGE_HERO_ALT_MAX_LENGTH,
  HOMEPAGE_HERO_DEFAULT_ALT,
  HOMEPAGE_HERO_FALLBACK_IMAGE,
  homepageHeroAcceptAttribute,
  homepageHeroStoragePath,
  isHomepageHeroStoragePath,
  normalizeHomepageHeroAltText,
  persistHomepageHero,
  resolveHomepageHero,
  restoreHomepageHeroDefault,
  validateHomepageHeroFile,
} from '../lib/homepage-hero.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const heroId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const nextId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const currentPath = `settings/homepage/hero-${heroId}.webp`;
const nextPath = `settings/homepage/hero-${nextId}.jpg`;
const pendingFile = { name: 'salon.JPG', type: 'image/jpeg', size: 2048 };

const constraints = {
  bucket: ARTWORK_IMAGES_BUCKET,
  fileSizeLimitBytes: 10_485_760,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
};

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function tracker() {
  const uploads = [];
  const deletes = [];
  const settings = [];
  return {
    uploads,
    deletes,
    settings,
    uploadFile: async ({ path: storagePath, file }) => {
      uploads.push({ path: storagePath, file });
      return { status: 200 };
    },
    deleteStorage: async ({ path: storagePath }) => {
      deletes.push(storagePath);
      return { status: 200 };
    },
    updateSettings: async (body) => {
      settings.push(body);
      return { ...body, updatedAt: '2026-11-24T00:00:00.000Z' };
    },
  };
}

test('hero path helper stores under settings/homepage/hero-{uuid}.{ext}', () => {
  assert.equal(homepageHeroStoragePath('salon.PNG', heroId), `settings/homepage/hero-${heroId}.png`);
  assert.equal(homepageHeroStoragePath('salon.JPEG', heroId), `settings/homepage/hero-${heroId}.jpeg`);
  assert.equal(homepageHeroStoragePath('salon.webp', heroId), currentPath);
  assert.equal(isHomepageHeroStoragePath(currentPath), true);
  assert.equal(isHomepageHeroStoragePath(nextPath), true);
  assert.equal(isHomepageHeroStoragePath('https://evil.example/hero.webp'), false);
  assert.equal(isHomepageHeroStoragePath(`settings/homepage/../hero-${heroId}.webp`), false);
  assert.equal(isHomepageHeroStoragePath('settings/homepage/hero.webp'), false);
  assert.equal(isHomepageHeroStoragePath(`settings/homepage/hero-${heroId}.gif`), false);
  assert.equal(isHomepageHeroStoragePath(`artworks/${heroId}/primary.webp`), false);
});

test('hero file validation uses bucket limits and rejects unsupported hero extensions', () => {
  assert.equal(
    validateHomepageHeroFile(
      { name: 'salon.webp', type: 'image/webp', size: 2048 },
      constraints,
      { ok: true, kind: 'webp', mime: 'image/webp' },
    ).ok,
    true,
  );
  assert.equal(
    validateHomepageHeroFile(
      { name: 'salon.avif', type: 'image/avif', size: 2048 },
      constraints,
      { ok: true, kind: 'avif', mime: 'image/avif' },
    ).ok,
    false,
  );
  assert.match(
    homepageHeroAcceptAttribute(constraints),
    /image\/jpeg/,
  );
  assert.doesNotMatch(homepageHeroAcceptAttribute(constraints), /avif/);
  assert.equal(normalizeHomepageHeroAltText('  Salon  '), 'Salon');
  assert.equal(normalizeHomepageHeroAltText(''), null);
  assert.throws(() => normalizeHomepageHeroAltText('<b>x</b>'));
  assert.throws(() => normalizeHomepageHeroAltText('x'.repeat(HOMEPAGE_HERO_ALT_MAX_LENGTH + 1)));
});

test('upload failure retains the current hero and never calls settings', async () => {
  const flow = tracker();
  await assert.rejects(
    () => persistHomepageHero({
      pendingFile,
      currentStoragePath: currentPath,
      altText: 'Salon',
      uploadFile: async () => {
        throw new Error('bucket policy denied');
      },
      deleteStorage: flow.deleteStorage,
      updateSettings: flow.updateSettings,
      createPath: () => nextPath,
    }),
    (error) => error.message === 'bucket policy denied',
  );
  assert.deepEqual(flow.settings, []);
  assert.deepEqual(flow.deletes, [nextPath]);
});

test('settings update runs only after a successful upload, then old object is deleted', async () => {
  const flow = tracker();
  const order = [];
  const saved = await persistHomepageHero({
    pendingFile,
    currentStoragePath: currentPath,
    altText: '  Maison salon  ',
    uploadFile: async (session) => {
      order.push(`upload:${session.path}`);
      return flow.uploadFile(session);
    },
    deleteStorage: async (session) => {
      order.push(`delete:${session.path}`);
      return flow.deleteStorage(session);
    },
    updateSettings: async (body) => {
      order.push(`settings:${body.storagePath}`);
      return flow.updateSettings(body);
    },
    createPath: () => nextPath,
  });

  assert.equal(saved.storagePath, nextPath);
  assert.equal(saved.altText, 'Maison salon');
  assert.deepEqual(order, [
    `upload:${nextPath}`,
    `settings:${nextPath}`,
    `delete:${currentPath}`,
  ]);
  assert.equal(flow.deletes.includes(currentPath), true);
  assert.equal(flow.deletes.includes(nextPath), false);
});

test('failed settings update keeps the old hero and cleans up the new object', async () => {
  const flow = tracker();
  await assert.rejects(
    () => persistHomepageHero({
      pendingFile,
      currentStoragePath: currentPath,
      altText: 'Salon',
      uploadFile: flow.uploadFile,
      deleteStorage: flow.deleteStorage,
      updateSettings: async () => {
        throw new Error('validation failed');
      },
      createPath: () => nextPath,
    }),
    (error) => {
      assert.equal(error.code, 'HERO_SETTINGS_AFTER_UPLOAD_FAILED');
      assert.match(error.message, /previous hero was kept/);
      assert.match(error.message, /newly uploaded image was removed/);
      return true;
    },
  );
  assert.deepEqual(flow.uploads.map((item) => item.path), [nextPath]);
  assert.deepEqual(flow.deletes, [nextPath]);
});

test('failed settings update surfaces cleanup failure without deleting the current hero', async () => {
  await assert.rejects(
    () => persistHomepageHero({
      pendingFile,
      currentStoragePath: currentPath,
      altText: 'Salon',
      uploadFile: async () => ({ status: 200 }),
      deleteStorage: async () => {
        throw new Error('Invalid JWT');
      },
      updateSettings: async () => {
        throw new Error('database timeout');
      },
      createPath: () => nextPath,
    }),
    (error) => {
      assert.equal(error.code, 'HERO_SETTINGS_CLEANUP_FAILED');
      assert.equal(error.storagePath, nextPath);
      assert.match(error.message, /previous hero was kept/);
      assert.doesNotMatch(error.message, new RegExp(currentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    },
  );
});

test('alt-only save does not touch Storage', async () => {
  const flow = tracker();
  const saved = await persistHomepageHero({
    pendingFile: null,
    currentStoragePath: currentPath,
    altText: 'Updated alt',
    uploadFile: flow.uploadFile,
    deleteStorage: flow.deleteStorage,
    updateSettings: flow.updateSettings,
  });
  assert.equal(saved.storagePath, currentPath);
  assert.equal(saved.altText, 'Updated alt');
  assert.deepEqual(flow.uploads, []);
  assert.deepEqual(flow.deletes, []);
});

test('restore default publishes null path before best-effort Storage delete', async () => {
  const flow = tracker();
  const order = [];
  const saved = await restoreHomepageHeroDefault({
    currentStoragePath: currentPath,
    altText: 'Salon',
    deleteStorage: async (session) => {
      order.push(`delete:${session.path}`);
      return flow.deleteStorage(session);
    },
    updateSettings: async (body) => {
      order.push(`settings:${body.storagePath}`);
      return flow.updateSettings(body);
    },
  });
  assert.equal(saved.storagePath, null);
  assert.deepEqual(order, [`settings:null`, `delete:${currentPath}`]);
});

test('restore default skips Storage delete when settings update fails', async () => {
  const flow = tracker();
  await assert.rejects(
    () => restoreHomepageHeroDefault({
      currentStoragePath: currentPath,
      altText: 'Salon',
      deleteStorage: flow.deleteStorage,
      updateSettings: async () => {
        throw new Error('forbidden');
      },
    }),
    (error) => error.message === 'forbidden',
  );
  assert.deepEqual(flow.deletes, []);
});

test('admin settings page mounts hero form beside unchanged WhatsApp settings', () => {
  const page = read('app/admin/settings/page.js');
  const form = read('components/homepage-hero-form.js');
  const whatsapp = read('components/whatsapp-settings-form.js');
  const salon = read('app/(gallery)/(salon)/page.js');

  assert.match(page, /WhatsappSettingsForm/);
  assert.match(page, /HomepageHeroForm/);
  assert.match(page, /Homepage Hero Banner/);
  assert.match(page, /adminWhatsappSettings/);
  assert.match(page, /adminHomepageHeroSettings/);

  assert.match(form, /Save \/ Publish/);
  assert.match(form, /Restore default/);
  assert.match(form, /window\.confirm/);
  assert.match(form, /persistHomepageHero/);
  assert.match(form, /restoreHomepageHeroDefault/);
  assert.match(form, /useArtworkImageConstraints/);
  assert.match(form, /uploadArtworkImageFile|persistHomepageHero/);
  assert.match(form, /HOMEPAGE_HERO_FALLBACK_IMAGE/);
  assert.match(form, /max-h-80/);
  assert.match(form, /pendingButtonProps\(pending\)/);
  assert.doesNotMatch(form, /service_role|SERVICE_ROLE|NEXT_PUBLIC_.*SERVICE/);
  assert.match(form, /getBrowserAccessToken/);

  assert.match(whatsapp, /updateAdminWhatsappSettings/);
  assert.doesNotMatch(whatsapp, /homepage-hero|HomepageHero/);

  assert.match(salon, /loadHomepageHero/);
  assert.doesNotMatch(salon, /adminHomepageHeroSettings|admin\/settings\/homepage-hero/);
});

test('storefront homepage hero uses Storage URL, fallback, cache-bust and unchanged copy', () => {
  const publicUrl = (storagePath) => `https://example.supabase.co/storage/v1/object/public/artwork-images/${storagePath}`;
  const configured = resolveHomepageHero({
    storagePath: currentPath,
    altText: "Maison d'Art salon interior",
    updatedAt: '2026-11-24T12:00:00.000Z',
  }, { publicUrl });
  const later = resolveHomepageHero({
    storagePath: currentPath,
    altText: "Maison d'Art salon interior",
    updatedAt: '2026-11-25T12:00:00.000Z',
  }, { publicUrl });
  const missing = resolveHomepageHero(null, { publicUrl });
  const empty = resolveHomepageHero({ storagePath: null, altText: null, updatedAt: null }, { publicUrl });
  const invalid = resolveHomepageHero({
    storagePath: 'https://evil.example/hero.webp',
    altText: 'Ignored remote',
    updatedAt: '2026-11-24T12:00:00.000Z',
  }, { publicUrl });

  assert.equal(configured.unoptimized, true);
  assert.match(configured.src, /\/storage\/v1\/object\/public\/artwork-images\/settings\/homepage\/hero-/);
  assert.match(configured.src, /v=2026-11-24T12%3A00%3A00\.000Z/);
  assert.equal(configured.alt, "Maison d'Art salon interior");
  assert.notEqual(configured.src, later.src);
  assert.match(later.src, /v=2026-11-25T12%3A00%3A00\.000Z/);

  assert.equal(missing.src, HOMEPAGE_HERO_FALLBACK_IMAGE);
  assert.equal(missing.unoptimized, false);
  assert.equal(missing.alt, HOMEPAGE_HERO_DEFAULT_ALT);
  assert.equal(empty.src, HOMEPAGE_HERO_FALLBACK_IMAGE);
  assert.equal(invalid.src, HOMEPAGE_HERO_FALLBACK_IMAGE);
  assert.equal(invalid.unoptimized, false);

  const page = read('app/(gallery)/(salon)/page.js');
  const loaders = read('lib/gallery-entity-loaders.js');
  assert.match(page, /src=\{hero\.src\}/);
  assert.match(page, /alt=\{hero\.alt\}/);
  assert.match(page, /priority/);
  assert.match(page, /sizes="100vw"/);
  assert.match(page, /object-cover object-center/);
  assert.match(page, /unoptimized: true/);
  assert.match(page, /Art That Transcends/);
  assert.match(page, /Space &amp; Silence/);
  assert.match(page, /Explore current exhibition/);
  assert.match(page, /Discover our philosophy/);
  assert.match(page, /href="\/explore"/);
  assert.match(page, /href="\/about"/);
  assert.match(page, /Current Curation \/ Vérité Salon/);
  assert.doesNotMatch(page, /unstable_cache|revalidate/);
  assert.match(loaders, /export const loadHomepageHero = cache\(/);
  assert.match(loaders, /getHomepageHero/);
  assert.match(loaders, /resolveHomepageHero\(null\)/);
  assert.doesNotMatch(loaders, /unstable_cache|revalidate/);
});

test('hero helpers and upload client never use service-role credentials', () => {
  const helper = read('lib/homepage-hero.js');
  const upload = read('lib/artwork-image-upload.js');
  assert.match(helper, /settings\/homepage\/hero-/);
  assert.match(helper, /crypto\.randomUUID/);
  assert.equal(HOMEPAGE_HERO_FALLBACK_IMAGE, '/images/hero-salon.webp');
  assert.doesNotMatch(helper, /service_role|SERVICE_ROLE/);
  assert.doesNotMatch(upload, /NEXT_PUBLIC_.*SERVICE_ROLE/);
});
