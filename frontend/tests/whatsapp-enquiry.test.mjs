import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADMIN_NAV_LINKS } from '../lib/admin-nav.js';
import {
  buildWhatsappEnquiryHref,
  buildWhatsappEnquiryMessage,
  DEFAULT_WHATSAPP_BUTTON_LABEL,
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
  assert.match(detail, /getWhatsappEnquiry/);
  assert.match(detail, /buildWhatsappEnquiryHref/);
  assert.match(detail, /canonicalFor\(`\/artwork\/\$\{artwork\.id\}`\)/);
  assert.match(detail, /wa\.me|whatsappHref/);
  assert.match(detail, /target="_blank"/);
  assert.match(detail, /rel="noopener noreferrer"/);
  assert.doesNotMatch(detail, /Curatorial inquiry/);
  assert.doesNotMatch(detail, /href="\/contact"/);
  assert.match(detail, /DEFAULT_WHATSAPP_BUTTON_LABEL|Enquire on WhatsApp/);
  assert.doesNotMatch(detail, /graph\.facebook|WhatsApp Business|cloud api/i);
});

test('artwork cards and contact do not add WhatsApp enquiry CTAs', () => {
  const card = read('components/artwork-card.js');
  const contact = read('app/(gallery)/contact/page.js');
  assert.doesNotMatch(card, /wa\.me|whatsapp|getWhatsappEnquiry/i);
  assert.doesNotMatch(contact, /wa\.me|getWhatsappEnquiry/i);
});

test('default WhatsApp button label matches the audit copy', () => {
  assert.equal(DEFAULT_WHATSAPP_BUTTON_LABEL, 'Enquire on WhatsApp');
});
