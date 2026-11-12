import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { desc, eq } from 'drizzle-orm';
import { client, db } from '../src/config/database.js';
import { auditLogs } from '../src/db/schema/index.js';
import {
  buildWhatsappEnquiryHref,
  maskWhatsappE164,
  normalizeWhatsappE164,
  toPublicWhatsappSnapshot,
} from '../src/lib/whatsapp-enquiry.js';
import { resetAuthDependencies, setAuthDependencies } from '../src/middlewares/auth.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';
import { whatsappSettingsBody } from '../src/validators/settings.validators.js';
import { api, stopTestServer } from './helpers/http.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
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

async function settingsReady() {
  const health = await api('/api/v1/health/db');
  if (health.status !== 200) {
    return false;
  }
  const response = await api('/api/v1/enquiry/whatsapp');
  return response.status === 200;
}

afterEach(() => {
  resetAuthDependencies();
});

after(async () => {
  await stopTestServer();
});

test('forward-only 0011 creates app_settings without editing 0000–0010', () => {
  const migrationsDir = path.join(backendRoot, 'src/db/migrations');
  assert.equal(fs.existsSync(path.join(migrationsDir, '0011_app_settings.sql')), true);
  const sql = fs.readFileSync(path.join(migrationsDir, '0011_app_settings.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE "app_settings"/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE "app_settings" TO maison_app/);
  assert.doesNotMatch(sql, /GRANT DELETE ON TABLE "app_settings"/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FOR SELECT TO maison_app/);
  assert.match(sql, /whatsapp_enquiry/);
  assert.doesNotMatch(sql, /TO anon|TO authenticated/);
  assert.doesNotMatch(sql, /ALTER TABLE "artists"|ALTER TABLE "artworks"/);

  const frozen = [
    '0000_phase1_identity_gallery.sql',
    '0001_phase2_wishlists_previews.sql',
    '0002_phase3_orders_inventory.sql',
    '0003_phase4_payments_shipping.sql',
    '0004_phase5_notifications_audit.sql',
    '0005_security_hardening.sql',
    '0006_feature_expansion.sql',
    '0007_storage_admin_from_user_roles.sql',
    '0008_artwork_images_admin_delete.sql',
    '0009_blogs.sql',
    '0010_artists.sql',
  ];
  for (const file of frozen) {
    assert.equal(fs.existsSync(path.join(migrationsDir, file)), true);
  }
});

test('E.164 normalize, mask and public snapshot hide the number when disabled', () => {
  assert.equal(normalizeWhatsappE164('+91 98765-43210'), '+919876543210');
  assert.equal(normalizeWhatsappE164('00919876543210'), '+919876543210');
  assert.equal(normalizeWhatsappE164('919876543210'), '+919876543210');
  assert.equal(normalizeWhatsappE164('+0123'), null);
  assert.equal(normalizeWhatsappE164('123'), null);
  assert.equal(maskWhatsappE164('+919876543210'), '+91••••••3210');
  assert.deepEqual(
    toPublicWhatsappSnapshot({ enabled: true, e164: '+919876543210', buttonLabel: null }),
    {
      enabled: true,
      e164: '919876543210',
      buttonLabel: 'Enquire on WhatsApp',
      waMeHost: 'https://wa.me',
    },
  );
  assert.deepEqual(toPublicWhatsappSnapshot({ enabled: false, e164: '+919876543210' }), { enabled: false });
  assert.deepEqual(toPublicWhatsappSnapshot({ enabled: true, e164: 'bad' }), { enabled: false });
  assert.equal(JSON.stringify(toPublicWhatsappSnapshot({ enabled: false, e164: '+919876543210' })).includes('9198'), false);
});

test('wa.me href encodes the enquiry message', () => {
  const href = buildWhatsappEnquiryHref({
    e164: '+919876543210',
    title: "Lotus in Moonlight",
    id: 'lot-id',
    url: 'https://example.test/artwork/lot-id',
  });
  assert.match(href, /^https:\/\/wa\.me\/919876543210\?text=/);
  const text = decodeURIComponent(href.split('text=')[1]);
  assert.match(text, /Hello Maison d'Art,/);
  assert.match(text, /Title: Lotus in Moonlight/);
});

test('whatsapp settings validator requires a boolean enabled flag', () => {
  assert.equal(whatsappSettingsBody.safeParse({ enabled: true, e164: '+919876543210' }).success, true);
  assert.equal(whatsappSettingsBody.safeParse({ enabled: false }).success, true);
  assert.equal(whatsappSettingsBody.safeParse({}).success, false);
  assert.equal(whatsappSettingsBody.safeParse({ enabled: 'yes' }).success, false);
  assert.equal(whatsappSettingsBody.safeParse({ enabled: true, buttonLabel: 'x'.repeat(41) }).success, false);
});

test('public WhatsApp enquiry is unauthenticated', async () => {
  const response = await api('/api/v1/enquiry/whatsapp');
  assert.notEqual(response.status, 401);
  assert.notEqual(response.status, 403);
  if (response.status !== 200) {
    return;
  }
  assert.equal(response.json.success, true);
  assert.equal(typeof response.json.data.enabled, 'boolean');
  if (response.json.data.enabled !== true) {
    assert.equal('e164' in response.json.data, false);
  }
});

test('customers cannot read or write admin WhatsApp settings', async () => {
  mockIdentity();
  const readResponse = await api('/api/v1/admin/settings/whatsapp', {
    headers: { Authorization: 'Bearer customer-token' },
  });
  assert.equal(readResponse.status, 403);

  const writeResponse = await api('/api/v1/admin/settings/whatsapp', {
    method: 'PUT',
    headers: { Authorization: 'Bearer customer-token' },
    body: { enabled: true, e164: '+919876543210' },
  });
  assert.equal(writeResponse.status, 403);
});

test('unauthenticated callers cannot write WhatsApp settings', async () => {
  const response = await api('/api/v1/admin/settings/whatsapp', {
    method: 'PUT',
    body: { enabled: true, e164: '+919876543210' },
  });
  assert.equal(response.status, 401);
});

test('admin WhatsApp settings validate, persist, hide publicly and audit with a masked number', async (t) => {
  if (!await settingsReady()) {
    t.skip('database or app_settings migration is not reachable from this environment');
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
  const previous = await api('/api/v1/admin/settings/whatsapp', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.equal(previous.status, 200);

  try {
    const missingNumber = await api('/api/v1/admin/settings/whatsapp', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { enabled: true, e164: '' },
    });
    assert.equal(missingNumber.status, 400);

    const invalid = await api('/api/v1/admin/settings/whatsapp', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { enabled: true, e164: '123' },
    });
    assert.equal(invalid.status, 400);

    const htmlLabel = await api('/api/v1/admin/settings/whatsapp', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { enabled: false, e164: '+919876543210', buttonLabel: '<script>x</script>' },
    });
    assert.equal(htmlLabel.status, 400);

    const enabled = await api('/api/v1/admin/settings/whatsapp', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: true,
        e164: '+91 98765 43210',
        buttonLabel: 'Talk on WhatsApp',
      },
    });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.json.data.enabled, true);
    assert.equal(enabled.json.data.e164, '+919876543210');
    assert.equal(enabled.json.data.buttonLabel, 'Talk on WhatsApp');

    const publicEnabled = await api('/api/v1/enquiry/whatsapp');
    assert.equal(publicEnabled.status, 200);
    assert.equal(publicEnabled.json.data.enabled, true);
    assert.equal(publicEnabled.json.data.e164, '919876543210');
    assert.equal(publicEnabled.json.data.buttonLabel, 'Talk on WhatsApp');
    assert.equal(publicEnabled.json.data.waMeHost, 'https://wa.me');
    assert.equal(JSON.stringify(publicEnabled.json.data).includes('+91'), false);

    const disabled = await api('/api/v1/admin/settings/whatsapp', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: { enabled: false, e164: '+919876543210', buttonLabel: 'Talk on WhatsApp' },
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.json.data.enabled, false);

    const publicDisabled = await api('/api/v1/enquiry/whatsapp');
    assert.equal(publicDisabled.status, 200);
    assert.equal(publicDisabled.json.data.enabled, false);
    assert.equal('e164' in publicDisabled.json.data, false);

    const [last] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'settings.whatsapp.update'))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    assert.ok(last);
    assert.equal(last.entityType, 'app_settings');
    assert.equal(last.entityId, null);
    assert.equal(last.metadata?.e164, '+91••••••3210');
    assert.doesNotMatch(JSON.stringify(last.metadata || {}), /98765/);
  } finally {
    await api('/api/v1/admin/settings/whatsapp', {
      method: 'PUT',
      headers: { Authorization: 'Bearer admin-token' },
      body: {
        enabled: Boolean(previous.json.data.enabled),
        e164: previous.json.data.e164 || null,
        buttonLabel: previous.json.data.buttonLabel || null,
      },
    });
  }
});
