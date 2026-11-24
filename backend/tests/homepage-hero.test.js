import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { desc, eq } from 'drizzle-orm';
import { client, db } from '../src/config/database.js';
import { APP_SETTING_HOMEPAGE_HERO, auditLogs } from '../src/db/schema/index.js';
import {
  HOMEPAGE_HERO_ALT_MAX_LENGTH,
  assertHomepageHeroStoragePath,
  homepageHeroStoragePath,
  isHomepageHeroStoragePath,
  normalizeHomepageHeroAltText,
  normalizeHomepageHeroStoragePath,
  toHomepageHeroSnapshot,
} from '../src/lib/homepage-hero.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { homepageHeroSettingsBody } from '../src/validators/settings.validators.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const heroId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const heroIdB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const validPath = `settings/homepage/hero-${heroId}.webp`;
const validPathB = `settings/homepage/hero-${heroIdB}.jpg`;
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function mockIdentity(actorAdminId = adminId) {
  setAuthDependencies({
    verifyAccessToken: async (token) => {
      if (token === 'customer-token') {
        return { userId: customerId, email: 'customer@example.com', fullName: 'Customer' };
      }
      if (token === 'admin-token') {
        return { userId: actorAdminId, email: 'admin@example.com', fullName: 'Admin' };
      }
      throw new ApiError(401, 'Invalid or expired access token');
    },
    provisionIdentity: async () => {},
    loadProfileWithRoles: async (userId) => ({
      profile: { id: userId, fullName: userId === actorAdminId ? 'Admin' : 'Customer' },
      roles: userId === actorAdminId ? ['customer', 'admin'] : ['customer'],
    }),
  });
}

function assertPublicHeroShape(data) {
  assert.deepEqual(Object.keys(data).sort(), ['altText', 'storagePath', 'updatedAt']);
  assert.equal('updatedBy' in data, false);
  assert.equal('updated_by' in data, false);
  assert.equal('value' in data, false);
  assert.equal('key' in data, false);
  assert.equal('actorUserId' in data, false);
}

async function heroReady() {
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    return false;
  }
  const response = await api('/api/v1/homepage/hero');
  return response.status === 200;
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('homepage hero reuses app_settings without a new migration or table', () => {
  const migrationsDir = path.join(backendRoot, 'src/db/migrations');
  assert.equal(fs.existsSync(path.join(migrationsDir, '0011_app_settings.sql')), true);
  assert.equal(fs.existsSync(path.join(migrationsDir, '0014_homepage_hero.sql')), false);

  const schema = fs.readFileSync(path.join(backendRoot, 'src/db/schema/app-settings.schema.js'), 'utf8');
  assert.match(schema, /APP_SETTING_HOMEPAGE_HERO = 'homepage_hero'/);
  assert.match(schema, /APP_SETTING_WHATSAPP_ENQUIRY = 'whatsapp_enquiry'/);
  assert.equal(APP_SETTING_HOMEPAGE_HERO, 'homepage_hero');

  const service = fs.readFileSync(path.join(backendRoot, 'src/services/settings.service.js'), 'utf8');
  assert.doesNotMatch(service, /SUPABASE_SERVICE_ROLE_KEY|service_role|serviceRole/);
});

test('hero path helper stores under settings/homepage/hero-{id}.{ext}', () => {
  assert.equal(
    homepageHeroStoragePath('salon.PNG', heroId),
    `settings/homepage/hero-${heroId}.png`,
  );
  assert.equal(
    homepageHeroStoragePath('salon.JPEG', heroId),
    `settings/homepage/hero-${heroId}.jpeg`,
  );
  assert.equal(
    homepageHeroStoragePath('salon.webp', heroId),
    validPath,
  );
  assert.equal(isHomepageHeroStoragePath(validPath), true);
  assert.equal(isHomepageHeroStoragePath(validPathB), true);
  assert.equal(normalizeHomepageHeroStoragePath(` ${validPath} `), validPath);
});

test('hero path helper rejects arbitrary URLs, traversal and unsupported extensions', () => {
  const rejected = [
    'https://evil.example/hero.webp',
    'http://cdn.example/settings/homepage/hero.webp',
    `settings/homepage/../hero-${heroId}.webp`,
    `settings/homepage/hero-${heroId}.webp/../../secret`,
    `settings/homepage/hero-${heroId}.gif`,
    `settings/homepage/hero-${heroId}.avif`,
    'settings/homepage/hero.webp',
    `settings/homepage/hero-not-a-uuid.webp`,
    `artworks/${heroId}/primary.webp`,
    `/${validPath}`,
    `settings\\homepage\\hero-${heroId}.webp`,
    '',
    null,
  ];

  for (const value of rejected) {
    assert.equal(isHomepageHeroStoragePath(value), false, String(value));
    assert.throws(
      () => assertHomepageHeroStoragePath(value),
      (error) => error instanceof ApiError && error.statusCode === 400,
    );
  }
});

test('hero alt text is plain text up to 160 characters', () => {
  assert.equal(normalizeHomepageHeroAltText('  Salon interior  '), 'Salon interior');
  assert.equal(normalizeHomepageHeroAltText(''), null);
  assert.equal(normalizeHomepageHeroAltText(null), null);
  assert.equal(normalizeHomepageHeroAltText('x'.repeat(HOMEPAGE_HERO_ALT_MAX_LENGTH)).length, 160);
  assert.throws(
    () => normalizeHomepageHeroAltText('x'.repeat(HOMEPAGE_HERO_ALT_MAX_LENGTH + 1)),
    (error) => error instanceof ApiError && error.statusCode === 400,
  );
  assert.throws(
    () => normalizeHomepageHeroAltText('<script>x</script>'),
    (error) => error instanceof ApiError && error.statusCode === 400,
  );
});

test('missing hero settings snapshot exposes only public fields', () => {
  assert.deepEqual(toHomepageHeroSnapshot(null), {
    storagePath: null,
    altText: null,
    updatedAt: null,
  });
  assertPublicHeroShape(toHomepageHeroSnapshot(null));
  assertPublicHeroShape(toHomepageHeroSnapshot({
    value: {
      storagePath: validPath,
      altText: 'Salon',
      updatedBy: 'secret',
      internal: true,
    },
    updatedBy: 'should-not-leak',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }));
  assert.deepEqual(
    toHomepageHeroSnapshot({
      value: { storagePath: 'https://evil.example/x.webp', altText: '<b>x</b>' },
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    {
      storagePath: null,
      altText: null,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  );
});

test('homepage hero validator accepts null path and rejects overlong alt text', () => {
  assert.equal(homepageHeroSettingsBody.safeParse({ storagePath: validPath, altText: 'Salon' }).success, true);
  assert.equal(homepageHeroSettingsBody.safeParse({ storagePath: null }).success, true);
  assert.equal(homepageHeroSettingsBody.safeParse({}).success, false);
  assert.equal(
    homepageHeroSettingsBody.safeParse({
      storagePath: validPath,
      altText: 'x'.repeat(HOMEPAGE_HERO_ALT_MAX_LENGTH + 1),
    }).success,
    false,
  );
});

test('public homepage hero is unauthenticated', async () => {
  const response = await api('/api/v1/homepage/hero');
  assert.notEqual(response.status, 401);
  assert.notEqual(response.status, 403);
  if (response.status !== 200) {
    return;
  }
  assert.equal(response.json.success, true);
  assertPublicHeroShape(response.json.data);
});

test('customers cannot read or write admin homepage hero settings', async () => {
  mockIdentity();
  const readResponse = await api('/api/v1/admin/settings/homepage-hero', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(readResponse.status, 403);

  const writeResponse = await api('/api/v1/admin/settings/homepage-hero', {
    method: 'PUT',
    headers: { Authorization: 'Bearer customer-token' },
    body: { storagePath: validPath, altText: 'Salon' },
  });
  assert.equal(writeResponse.status, 403);
});

test('unauthenticated callers cannot read or write admin homepage hero settings', async () => {
  const readResponse = await api('/api/v1/admin/settings/homepage-hero');
  assert.equal(readResponse.status, 401);

  const writeResponse = await api('/api/v1/admin/settings/homepage-hero', {
    method: 'PUT',
    body: { storagePath: validPath, altText: 'Salon' },
  });
  assert.equal(writeResponse.status, 401);
});

test('admin homepage hero validates, upserts, hides metadata publicly and audits', async (t) => {
  if (!await heroReady()) {
    t.skip('database or app_settings is not reachable from this environment');
    return;
  }

  const [foundAdmin] = await client`
    SELECT user_id
    FROM public.user_roles
    WHERE role = 'admin'
    LIMIT 1
  `;
  if (!foundAdmin?.user_id) {
    t.skip('no admin profile exists in this database');
    return;
  }

  mockIdentity(foundAdmin.user_id);
  const previous = await api('/api/v1/admin/settings/homepage-hero', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(previous.status, 200);
  assertPublicHeroShape(previous.json.data);

  try {
    const missingCleared = await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { storagePath: null, altText: null },
    });
    assert.equal(missingCleared.status, 200);
    assert.equal(missingCleared.json.data.storagePath, null);
    assert.equal(missingCleared.json.data.altText, null);
    assertPublicHeroShape(missingCleared.json.data);

    const publicMissing = await api('/api/v1/homepage/hero');
    assert.equal(publicMissing.status, 200);
    assert.equal(publicMissing.json.data.storagePath, null);
    assert.equal(publicMissing.json.data.altText, null);
    assertPublicHeroShape(publicMissing.json.data);
    assert.equal(JSON.stringify(publicMissing.json.data).includes('updatedBy'), false);
    assert.equal(JSON.stringify(publicMissing.json.data).includes(foundAdmin.user_id), false);

    const invalidUrl = await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { storagePath: 'https://evil.example/hero.webp', altText: 'Salon' },
    });
    assert.equal(invalidUrl.status, 400);

    const traversal = await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { storagePath: `settings/homepage/../hero-${heroId}.webp`, altText: 'Salon' },
    });
    assert.equal(traversal.status, 400);

    const missingId = await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { storagePath: 'settings/homepage/hero.webp', altText: 'Salon' },
    });
    assert.equal(missingId.status, 400);

    const unsupportedExt = await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { storagePath: `settings/homepage/hero-${heroId}.gif`, altText: 'Salon' },
    });
    assert.equal(unsupportedExt.status, 400);

    const htmlAlt = await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { storagePath: validPath, altText: '<script>x</script>' },
    });
    assert.equal(htmlAlt.status, 400);

    const longAlt = await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { storagePath: validPath, altText: 'x'.repeat(HOMEPAGE_HERO_ALT_MAX_LENGTH + 1) },
    });
    assert.equal(longAlt.status, 400);

    const created = await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { storagePath: validPath, altText: '  Maison salon  ' },
    });
    assert.equal(created.status, 200);
    assert.equal(created.json.data.storagePath, validPath);
    assert.equal(created.json.data.altText, 'Maison salon');
    assert.ok(created.json.data.updatedAt);
    assertPublicHeroShape(created.json.data);

    const publicCreated = await api('/api/v1/homepage/hero');
    assert.equal(publicCreated.status, 200);
    assert.equal(publicCreated.json.data.storagePath, validPath);
    assert.equal(publicCreated.json.data.altText, 'Maison salon');
    assert.ok(publicCreated.json.data.updatedAt);
    assertPublicHeroShape(publicCreated.json.data);
    assert.equal(JSON.stringify(publicCreated.json.data).includes('updatedBy'), false);
    assert.equal(JSON.stringify(publicCreated.json.data).includes(foundAdmin.user_id), false);

    const upserted = await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { storagePath: validPathB, altText: 'Replaced salon' },
    });
    assert.equal(upserted.status, 200);
    assert.equal(upserted.json.data.storagePath, validPathB);
    assert.equal(upserted.json.data.altText, 'Replaced salon');

    const publicUpserted = await api('/api/v1/homepage/hero');
    assert.equal(publicUpserted.status, 200);
    assert.equal(publicUpserted.json.data.storagePath, validPathB);
    assert.equal(publicUpserted.json.data.altText, 'Replaced salon');

    const [last] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'settings.homepage_hero.update'))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    assert.ok(last);
    assert.equal(last.entityType, 'app_settings');
    assert.equal(last.entityId, null);
    assert.equal(last.metadata?.key, APP_SETTING_HOMEPAGE_HERO);
    assert.equal(last.metadata?.storagePath, validPathB);
  } finally {
    await api('/api/v1/admin/settings/homepage-hero', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        storagePath: previous.json.data.storagePath,
        altText: previous.json.data.altText,
      },
    });
  }
});
