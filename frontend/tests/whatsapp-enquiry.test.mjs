import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADMIN_NAV_LINKS } from '../lib/admin-nav.js';
import {
  buildWhatsappContactHref,
  buildWhatsappContactMessage,
  buildWhatsappEnquiryHref,
  buildWhatsappEnquiryMessage,
  DEFAULT_WHATSAPP_BUTTON_LABEL,
  DEFAULT_WHATSAPP_CONTACT_MESSAGE,
  resolveWhatsappFloatHref,
  whatsappDigits,
} from '../lib/whatsapp-enquiry.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('admin navigation includes Settings at /admin/settings', () => {
  assert.equal(
    ADMIN_NAV_LINKS.some((link) => link.href === '/admin/settings' && link.label === 'Settings'),
    true,
  );
  assert.equal(fs.existsSync(path.join(frontendRoot, 'app/admin/settings/page.js')), true);
});

test('whatsapp digits accept E.164 and reject invalid numbers', () => {
  assert.equal(whatsappDigits('+91 98765 43210'), '919876543210');
  assert.equal(whatsappDigits('+919876543210'), '919876543210');
  assert.equal(whatsappDigits('919876543210'), '919876543210');
  assert.equal(whatsappDigits('+12025551234'), '12025551234');
  assert.equal(whatsappDigits('not-a-number'), null);
  assert.equal(whatsappDigits('+0123'), null);
  assert.equal(whatsappDigits(''), null);
});

test('enquiry href uses wa.me digits and encodes apostrophes and titles', () => {
  const href = buildWhatsappEnquiryHref({
    e164: '+919876543210',
    title: "Lotus in Moonlight — artist's proof",
    id: '8f3171f4-acbf-4024-a8d8-c7471b3644d5',
    url: 'https://maisondart.example/artwork/8f3171f4-acbf-4024-a8d8-c7471b3644d5',
  });

  assert.match(href, /^https:\/\/wa\.me\/919876543210\?text=/);
  const text = new URL(href).searchParams.get('text');
  assert.match(text, /Hello Maison d'Art,/);
  assert.match(text, /Lotus in Moonlight — artist's proof/);
  assert.match(text, /Reference: 8f3171f4-acbf-4024-a8d8-c7471b3644d5/);
  assert.match(text, /Page: https:\/\/maisondart\.example\/artwork\/8f3171f4-acbf-4024-a8d8-c7471b3644d5/);
  assert.equal(
    href.includes(encodeURIComponent("Maison d'Art")),
    true,
  );
  assert.equal(href.includes('+'), false);
});

test('enquiry message keeps the approved curatorial copy', () => {
  const message = buildWhatsappEnquiryMessage({
    title: 'Lotus in Moonlight',
    id: 'lot-id',
    url: 'https://example.test/artwork/lot-id',
  });
  assert.match(message, /^Hello Maison d'Art,/);
  assert.match(message, /I would like to enquire about this artwork\./);
  assert.match(message, /Title: Lotus in Moonlight/);
  assert.match(message, /Please share availability and how I may view or acquire this work\./);
  assert.doesNotMatch(message, /₹|INR|price/i);
});

test('artwork detail adds WhatsApp Click-to-Chat and does not keep the email enquiry CTA', () => {
  const detail = read('app/(gallery)/artwork/[id]/page.js');
  assert.match(detail, /loadWhatsappEnquiry/);
  assert.match(detail, /buildWhatsappEnquiryHref/);
  assert.match(detail, /canonicalFor\(`\/artwork\/\$\{artwork\.id\}`\)/);
  assert.match(detail, /title: artwork\.title/);
  assert.match(detail, /id: artwork\.id/);
  assert.match(detail, /url: pageUrl/);
  assert.match(detail, /wa\.me|whatsappHref/);
  assert.match(detail, /target="_blank"/);
  assert.match(detail, /rel="noopener noreferrer"/);
  assert.doesNotMatch(detail, /buildWhatsappContactHref/);
  assert.doesNotMatch(detail, /Curatorial inquiry/);
  assert.doesNotMatch(detail, /href="\/contact"/);
  assert.match(detail, /DEFAULT_WHATSAPP_BUTTON_LABEL|Enquire on WhatsApp/);
  assert.doesNotMatch(detail, /graph\.facebook|WhatsApp Business|cloud api/i);
});

test('artwork cards and contact do not add WhatsApp enquiry CTAs', () => {
  const card = read('components/artwork-card.js');
  const contact = read('app/(gallery)/contact/page.js');
  assert.doesNotMatch(card, /wa\.me|whatsapp|getWhatsappEnquiry/i);
  assert.doesNotMatch(contact, /wa\.me|getWhatsappEnquiry|WhatsappFloat/i);
  assert.match(contact, /mailto:atelier@maisondart\.example/);
});

test('default WhatsApp button label matches the audit copy', () => {
  assert.equal(DEFAULT_WHATSAPP_BUTTON_LABEL, 'Enquire on WhatsApp');
});

test('generic contact href uses wa.me digits and encodes the salon greeting', () => {
  const href = buildWhatsappContactHref({ e164: '+91 98765 43210' });

  assert.match(href, /^https:\/\/wa\.me\/919876543210\?text=/);
  assert.equal(new URL(href).searchParams.get('text'), DEFAULT_WHATSAPP_CONTACT_MESSAGE);
  assert.equal(buildWhatsappContactMessage(), "Hello, I would like to know more about Maison d'Art.");
  assert.equal(href.includes(encodeURIComponent("Maison d'Art")), true);
  assert.equal(href.includes('+'), false);
  assert.doesNotMatch(href, /Title:|Reference:|Page:/);
});

test('generic contact href rejects missing or invalid numbers', () => {
  assert.equal(buildWhatsappContactHref({}), null);
  assert.equal(buildWhatsappContactHref({ e164: '' }), null);
  assert.equal(buildWhatsappContactHref({ e164: 'not-a-number' }), null);
  assert.equal(buildWhatsappContactHref({ e164: '+0123' }), null);
});

test('floating widget href is null when WhatsApp is disabled or the number is invalid', () => {
  assert.equal(resolveWhatsappFloatHref({ enabled: false, e164: '919876543210' }), null);
  assert.equal(resolveWhatsappFloatHref({ enabled: true }), null);
  assert.equal(resolveWhatsappFloatHref({ enabled: true, e164: 'not-a-number' }), null);
  assert.equal(resolveWhatsappFloatHref(null), null);

  const href = resolveWhatsappFloatHref({ enabled: true, e164: '919876543210' });
  assert.match(href, /^https:\/\/wa\.me\/919876543210\?text=/);
  assert.equal(new URL(href).searchParams.get('text'), DEFAULT_WHATSAPP_CONTACT_MESSAGE);
});

test('floating WhatsApp widget renders a 48px Chat on WhatsApp control', () => {
  const widget = read('components/whatsapp-float.js');
  assert.match(widget, /resolveWhatsappFloatHref/);
  assert.match(widget, /return null/);
  assert.match(widget, /aria-label="Chat on WhatsApp"/);
  assert.match(widget, /title="Chat on WhatsApp"/);
  assert.match(widget, /target="_blank"/);
  assert.match(widget, /rel="noopener noreferrer"/);
  assert.match(widget, /z-40/);
  assert.match(widget, /h-12 w-12/);
  assert.match(widget, /whatsapp-float/);
  assert.doesNotMatch(widget, /useEffect|useState|'use client'/);

  const styles = read('app/globals.css');
  assert.match(styles, /\.whatsapp-float[\s\S]*safe-area-inset-right/);
  assert.match(styles, /\.whatsapp-float[\s\S]*safe-area-inset-bottom/);
});

test('gallery layout mounts the floating WhatsApp widget from the cached loader', () => {
  const layout = read('app/(gallery)/layout.js');
  const loaders = read('lib/gallery-entity-loaders.js');
  assert.match(layout, /loadWhatsappEnquiry/);
  assert.match(layout, /WhatsappFloat/);
  assert.match(loaders, /export const loadWhatsappEnquiry = cache\(/);
  assert.match(loaders, /getWhatsappEnquiry/);
  assert.match(loaders, /enabled: false/);
  assert.doesNotMatch(loaders, /unstable_cache|revalidate/);
});

test('admin layout, root layout and AR PoC do not mount the floating WhatsApp widget', () => {
  const adminLayout = read('app/admin/layout.js');
  const rootLayout = read('app/layout.js');
  const arPoc = read('app/dev/ar-poc/page.js');
  assert.doesNotMatch(adminLayout, /WhatsappFloat|loadWhatsappEnquiry|wa\.me/);
  assert.doesNotMatch(rootLayout, /WhatsappFloat|loadWhatsappEnquiry/);
  assert.doesNotMatch(arPoc, /WhatsappFloat|loadWhatsappEnquiry|wa\.me/);
});

test('admin WhatsApp settings copy covers the storefront widget', () => {
  const form = read('components/whatsapp-settings-form.js');
  assert.match(form, /enabled on the storefront/);
  assert.match(form, /hidden on the storefront/);
  assert.match(form, /including artwork pages/);
  assert.doesNotMatch(form, /only on artwork pages/i);
});
