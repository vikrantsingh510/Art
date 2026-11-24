import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { desc, eq } from 'drizzle-orm';
import { client, db } from '../src/config/database.js';
import { APP_SETTING_HOMEPAGE_FAQ, auditLogs } from '../src/db/schema/index.js';
import {
  HOMEPAGE_FAQ_ANSWER_MAX_LENGTH,
  HOMEPAGE_FAQ_HEADING_MAX_LENGTH,
  HOMEPAGE_FAQ_MAX_ITEMS,
  HOMEPAGE_FAQ_QUESTION_MAX_LENGTH,
  HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH,
  emptyPublicHomepageFaq,
  normalizeHomepageFaqDocument,
  toHomepageFaqSnapshot,
  toPublicHomepageFaq,
} from '../src/lib/homepage-faq.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { homepageFaqSettingsBody } from '../src/validators/settings.validators.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const faqIdA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const faqIdB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const faqIdC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function assertPublicFaqShape(data) {
  assert.deepEqual(Object.keys(data).sort(), ['enabled', 'heading', 'items', 'subtitle']);
  assert.equal('updatedBy' in data, false);
  assert.equal('updated_by' in data, false);
  assert.equal('updatedAt' in data, false);
  assert.equal('homepageLimit' in data, false);
  assert.equal('value' in data, false);
  assert.equal('key' in data, false);
  assert.ok(Array.isArray(data.items));
  for (const item of data.items) {
    assert.deepEqual(Object.keys(item).sort(), ['answer', 'id', 'question']);
    assert.equal('enabled' in item, false);
  }
}

function assertAdminFaqShape(data) {
  assert.deepEqual(
    Object.keys(data).sort(),
    ['enabled', 'heading', 'homepageLimit', 'items', 'subtitle', 'updatedAt'],
  );
  assert.equal('updatedBy' in data, false);
  assert.equal('updated_by' in data, false);
  assert.ok(Array.isArray(data.items));
  for (const item of data.items) {
    assert.deepEqual(Object.keys(item).sort(), ['answer', 'enabled', 'id', 'question']);
  }
}

function sampleItems() {
  return [
    {
      id: faqIdA,
      question: 'How is provenance recorded?',
      answer: 'Each work leaves the atelier with a written certificate.',
      enabled: true,
    },
    {
      id: faqIdB,
      question: 'Can a reserved viewing be arranged?',
      answer: 'Yes. Write to the salon with the lot reference.',
      enabled: false,
    },
    {
      id: faqIdC,
      question: 'Are shipping crates archival?',
      answer: 'Export crates are packed for permanence, not courier speed.',
      enabled: true,
    },
  ];
}

async function faqReady() {
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    return false;
  }
  const response = await api('/api/v1/homepage/faq');
  return response.status === 200;
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('homepage FAQ reuses app_settings without a new migration or table', () => {
  const migrationsDir = path.join(backendRoot, 'src/db/migrations');
  assert.equal(fs.existsSync(path.join(migrationsDir, '0011_app_settings.sql')), true);
  assert.equal(fs.existsSync(path.join(migrationsDir, '0014_homepage_faq.sql')), false);

  const schema = fs.readFileSync(path.join(backendRoot, 'src/db/schema/app-settings.schema.js'), 'utf8');
  assert.match(schema, /APP_SETTING_HOMEPAGE_FAQ = 'homepage_faq'/);
  assert.equal(APP_SETTING_HOMEPAGE_FAQ, 'homepage_faq');

  const service = fs.readFileSync(path.join(backendRoot, 'src/services/settings.service.js'), 'utf8');
  assert.doesNotMatch(service, /SUPABASE_SERVICE_ROLE_KEY|service_role|serviceRole/);
});

test('missing or disabled FAQ documents expose empty public defaults', () => {
  assert.deepEqual(toPublicHomepageFaq(null), emptyPublicHomepageFaq());
  assert.deepEqual(toPublicHomepageFaq({}), emptyPublicHomepageFaq());
  assert.deepEqual(
    toPublicHomepageFaq({
      enabled: false,
      heading: 'Hidden heading',
      subtitle: 'Hidden subtitle',
      homepageLimit: 2,
      items: sampleItems(),
    }),
    emptyPublicHomepageFaq(),
  );
  assertPublicFaqShape(toPublicHomepageFaq(null));
  assert.deepEqual(
    toHomepageFaqSnapshot(null),
    {
      enabled: false,
      heading: null,
      subtitle: null,
      homepageLimit: null,
      items: [],
      updatedAt: null,
    },
  );
});

test('public FAQ resolver keeps order, drops inactive items and applies the homepage limit', () => {
  const stored = {
    enabled: true,
    heading: 'From the atelier',
    subtitle: 'Acquisition notes for collectors.',
    homepageLimit: 1,
    items: sampleItems(),
    updatedBy: 'secret',
  };
  const limited = toPublicHomepageFaq(stored);
  assert.equal(limited.enabled, true);
  assert.equal(limited.heading, 'From the atelier');
  assert.deepEqual(limited.items.map((item) => item.id), [faqIdA]);
  assert.equal(limited.items.some((item) => item.id === faqIdB), false);
  assertPublicFaqShape(limited);

  const unlimited = toPublicHomepageFaq({ ...stored, homepageLimit: null });
  assert.deepEqual(unlimited.items.map((item) => item.id), [faqIdA, faqIdC]);
  assert.equal(unlimited.items.some((item) => item.question.includes('reserved viewing')), false);
  assertPublicFaqShape(unlimited);
});

test('FAQ document normalizer generates ids, strips unknown fields and rejects duplicates or HTML', () => {
  const generated = normalizeHomepageFaqDocument({
    enabled: true,
    heading: '  From the atelier  ',
    subtitle: '  Acquisition notes.  ',
    homepageLimit: 3,
    extra: 'drop',
    items: [
      { question: 'How is provenance recorded?', answer: 'With a certificate.', mystery: true },
    ],
  });
  assert.equal(generated.enabled, true);
  assert.equal(generated.heading, 'From the atelier');
  assert.equal(generated.subtitle, 'Acquisition notes.');
  assert.equal(generated.homepageLimit, 3);
  assert.equal('extra' in generated, false);
  assert.equal(generated.items.length, 1);
  assert.match(generated.items[0].id, UUID_PATTERN);
  assert.equal(generated.items[0].enabled, true);
  assert.equal('mystery' in generated.items[0], false);

  assert.throws(
    () => normalizeHomepageFaqDocument({
      enabled: true,
      items: [
        { id: faqIdA, question: 'One?', answer: 'Yes.' },
        { id: faqIdA, question: 'Two?', answer: 'No.' },
      ],
    }),
    (error) => error instanceof ApiError && error.statusCode === 400,
  );
  assert.throws(
    () => normalizeHomepageFaqDocument({
      enabled: true,
      heading: '<script>x</script>',
      items: [],
    }),
    (error) => error instanceof ApiError && error.statusCode === 400,
  );
  assert.throws(
    () => normalizeHomepageFaqDocument({
      enabled: true,
      items: [{ question: '<b>How?</b>', answer: 'Plain.' }],
    }),
    (error) => error instanceof ApiError && error.statusCode === 400,
  );
});

test('FAQ validator accepts a full document and rejects invalid lengths and limits', () => {
  assert.equal(homepageFaqSettingsBody.safeParse({
    enabled: false,
    heading: null,
    subtitle: null,
    homepageLimit: null,
    items: [],
  }).success, true);
  assert.equal(homepageFaqSettingsBody.safeParse({
    enabled: true,
    homepageLimit: 2,
    items: [{ question: 'How is provenance recorded?', answer: 'With a certificate.' }],
  }).success, true);
  assert.equal(homepageFaqSettingsBody.safeParse({}).success, false);
  assert.equal(homepageFaqSettingsBody.safeParse({
    enabled: true,
    heading: 'x'.repeat(HOMEPAGE_FAQ_HEADING_MAX_LENGTH + 1),
    items: [],
  }).success, false);
  assert.equal(homepageFaqSettingsBody.safeParse({
    enabled: true,
    subtitle: 'x'.repeat(HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH + 1),
    items: [],
  }).success, false);
  assert.equal(homepageFaqSettingsBody.safeParse({
    enabled: true,
    homepageLimit: 0,
    items: [],
  }).success, false);
  assert.equal(homepageFaqSettingsBody.safeParse({
    enabled: true,
    homepageLimit: 41,
    items: [],
  }).success, false);
  assert.equal(homepageFaqSettingsBody.safeParse({
    enabled: true,
    items: [{ question: 'x'.repeat(HOMEPAGE_FAQ_QUESTION_MAX_LENGTH + 1), answer: 'Yes.' }],
  }).success, false);
  assert.equal(homepageFaqSettingsBody.safeParse({
    enabled: true,
    items: [{ question: 'How?', answer: 'x'.repeat(HOMEPAGE_FAQ_ANSWER_MAX_LENGTH + 1) }],
  }).success, false);
  assert.equal(homepageFaqSettingsBody.safeParse({
    enabled: true,
    items: Array.from({ length: HOMEPAGE_FAQ_MAX_ITEMS + 1 }, (_, index) => ({
      question: `Question ${index}?`,
      answer: `Answer ${index}.`,
    })),
  }).success, false);
});

test('public homepage FAQ is unauthenticated', async () => {
  const response = await api('/api/v1/homepage/faq');
  assert.notEqual(response.status, 401);
  assert.notEqual(response.status, 403);
  if (response.status !== 200) {
    return;
  }
  assert.equal(response.json.success, true);
  assertPublicFaqShape(response.json.data);
});

test('customers cannot read or write admin homepage FAQ settings', async () => {
  mockIdentity();
  const readResponse = await api('/api/v1/admin/settings/homepage-faq', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(readResponse.status, 403);

  const writeResponse = await api('/api/v1/admin/settings/homepage-faq', {
    method: 'PUT',
    headers: { Authorization: 'Bearer customer-token' },
    body: { enabled: true, items: [] },
  });
  assert.equal(writeResponse.status, 403);
});

test('unauthenticated callers cannot read or write admin homepage FAQ settings', async () => {
  const readResponse = await api('/api/v1/admin/settings/homepage-faq');
  assert.equal(readResponse.status, 401);

  const writeResponse = await api('/api/v1/admin/settings/homepage-faq', {
    method: 'PUT',
    body: { enabled: true, items: [] },
  });
  assert.equal(writeResponse.status, 401);
});

test('admin homepage FAQ validates, upserts, hides unpublished items and audits', async (t) => {
  if (!await faqReady()) {
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
  const previous = await api('/api/v1/admin/settings/homepage-faq', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(previous.status, 200);
  assertAdminFaqShape(previous.json.data);

  try {
    const cleared = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: false,
        heading: null,
        subtitle: null,
        homepageLimit: null,
        items: [],
      },
    });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.json.data.enabled, false);
    assert.deepEqual(cleared.json.data.items, []);
    assertAdminFaqShape(cleared.json.data);

    const publicMissing = await api('/api/v1/homepage/faq');
    assert.equal(publicMissing.status, 200);
    assert.deepEqual(publicMissing.json.data, emptyPublicHomepageFaq());
    assertPublicFaqShape(publicMissing.json.data);
    assert.equal(JSON.stringify(publicMissing.json.data).includes('updatedBy'), false);

    const htmlHeading = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: true,
        heading: '<script>x</script>',
        items: [{ question: 'How is provenance recorded?', answer: 'With a certificate.' }],
      },
    });
    assert.equal(htmlHeading.status, 400);

    const htmlQuestion = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: true,
        items: [{ question: '<b>How?</b>', answer: 'With a certificate.' }],
      },
    });
    assert.equal(htmlQuestion.status, 400);

    const duplicateIds = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: true,
        items: [
          { id: faqIdA, question: 'One?', answer: 'First.' },
          { id: faqIdA, question: 'Two?', answer: 'Second.' },
        ],
      },
    });
    assert.equal(duplicateIds.status, 400);

    const tooLong = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: true,
        heading: 'x'.repeat(HOMEPAGE_FAQ_HEADING_MAX_LENGTH + 1),
        items: [],
      },
    });
    assert.equal(tooLong.status, 400);

    const invalidLimit = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: true,
        homepageLimit: 0,
        items: [],
      },
    });
    assert.equal(invalidLimit.status, 400);

    const generated = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: true,
        heading: 'From the atelier',
        subtitle: 'Acquisition notes for collectors.',
        homepageLimit: null,
        items: [
          { question: 'How is provenance recorded?', answer: 'Each work leaves with a certificate.' },
        ],
      },
    });
    assert.equal(generated.status, 200, JSON.stringify(generated.json));
    assert.equal(generated.json.data.items.length, 1);
    assert.match(generated.json.data.items[0].id, UUID_PATTERN);
    assert.equal(generated.json.data.items[0].enabled, true);
    assertAdminFaqShape(generated.json.data);

    const created = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: true,
        heading: 'From the atelier',
        subtitle: 'Acquisition notes for collectors.',
        homepageLimit: 1,
        items: sampleItems(),
      },
    });
    assert.equal(created.status, 200, JSON.stringify(created.json));
    assert.equal(created.json.data.enabled, true);
    assert.equal(created.json.data.homepageLimit, 1);
    assert.equal(created.json.data.items.length, 3);
    assert.deepEqual(created.json.data.items.map((item) => item.id), [faqIdA, faqIdB, faqIdC]);
    assert.ok(created.json.data.updatedAt);
    assertAdminFaqShape(created.json.data);
    assert.equal('updatedBy' in created.json.data, false);

    const publicCreated = await api('/api/v1/homepage/faq');
    assert.equal(publicCreated.status, 200);
    assert.equal(publicCreated.json.data.enabled, true);
    assert.equal(publicCreated.json.data.heading, 'From the atelier');
    assert.deepEqual(publicCreated.json.data.items.map((item) => item.id), [faqIdA]);
    assert.equal(JSON.stringify(publicCreated.json.data).includes('reserved viewing'), false);
    assert.equal(JSON.stringify(publicCreated.json.data).includes(foundAdmin.user_id), false);
    assert.equal(JSON.stringify(publicCreated.json.data).includes('homepageLimit'), false);
    assertPublicFaqShape(publicCreated.json.data);

    const unlimited = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: true,
        heading: 'From the atelier',
        subtitle: 'Acquisition notes for collectors.',
        homepageLimit: null,
        items: sampleItems(),
      },
    });
    assert.equal(unlimited.status, 200);
    const publicUnlimited = await api('/api/v1/homepage/faq');
    assert.equal(publicUnlimited.status, 200);
    assert.deepEqual(publicUnlimited.json.data.items.map((item) => item.id), [faqIdA, faqIdC]);
    assert.equal(JSON.stringify(publicUnlimited.json.data).includes('reserved viewing'), false);
    assertPublicFaqShape(publicUnlimited.json.data);

    const disabled = await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: false,
        heading: 'From the atelier',
        subtitle: 'Acquisition notes for collectors.',
        homepageLimit: null,
        items: sampleItems(),
      },
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.json.data.items.length, 3);
    const publicDisabled = await api('/api/v1/homepage/faq');
    assert.equal(publicDisabled.status, 200);
    assert.deepEqual(publicDisabled.json.data, emptyPublicHomepageFaq());
    assert.equal(JSON.stringify(publicDisabled.json.data).includes('provenance'), false);
    assertPublicFaqShape(publicDisabled.json.data);

    const [last] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'settings.homepage_faq.update'))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    assert.ok(last);
    assert.equal(last.entityType, 'app_settings');
    assert.equal(last.entityId, null);
    assert.deepEqual(Object.keys(last.metadata || {}).sort(), ['enabled', 'itemCount', 'key']);
    assert.equal(last.metadata.key, APP_SETTING_HOMEPAGE_FAQ);
    assert.equal(last.metadata.enabled, false);
    assert.equal(last.metadata.itemCount, 3);
    assert.equal(JSON.stringify(last.metadata).includes('provenance'), false);
    assert.equal(JSON.stringify(last.metadata).includes('certificate'), false);
  } finally {
    await api('/api/v1/admin/settings/homepage-faq', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: previous.json.data.enabled,
        heading: previous.json.data.heading,
        subtitle: previous.json.data.subtitle,
        homepageLimit: previous.json.data.homepageLimit,
        items: previous.json.data.items,
      },
    });
  }
});
