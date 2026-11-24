import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  addHomepageFaqItem,
  emptyPublicHomepageFaq,
  fieldsFromFaqSettings,
  homepageFaqPutBody,
  moveHomepageFaqItem,
  removeHomepageFaqItem,
  resolveHomepageFaq,
  shouldConfirmHomepageFaqDelete,
  shouldRenderHomepageFaq,
  toggleHomepageFaqOpenIds,
  updateHomepageFaqItem,
} from '../lib/homepage-faq.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

const loaded = {
  enabled: true,
  heading: 'From the atelier',
  subtitle: 'Acquisition notes for collectors.',
  homepageLimit: 2,
  items: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      question: 'How is provenance recorded?',
      answer: 'Each work leaves with a certificate.',
      enabled: true,
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      question: 'Can a reserved viewing be arranged?',
      answer: 'Write to the salon with the lot reference.',
      enabled: false,
    },
  ],
};

test('FAQ fields load from admin settings including limit and item order', () => {
  const fields = fieldsFromFaqSettings(loaded);
  assert.equal(fields.enabled, true);
  assert.equal(fields.heading, 'From the atelier');
  assert.equal(fields.showAll, false);
  assert.equal(fields.homepageLimit, 2);
  assert.equal(fields.items.length, 2);
  assert.equal(fields.items[0].id, loaded.items[0].id);
  assert.equal(fields.items[1].enabled, false);

  const empty = fieldsFromFaqSettings(null);
  assert.equal(empty.enabled, false);
  assert.equal(empty.showAll, true);
  assert.deepEqual(empty.items, []);
});

test('FAQ helpers add, edit, enable, reorder and delete locally', () => {
  const fields = fieldsFromFaqSettings(loaded);
  const withNew = addHomepageFaqItem(fields.items, 'temp');
  assert.equal(withNew.length, 3);
  assert.equal(withNew[2].id, null);
  assert.equal(withNew[2].enabled, true);
  assert.equal(withNew[2].question, '');

  const edited = updateHomepageFaqItem(withNew, 2, {
    question: 'Are shipping crates archival?',
    answer: 'Export crates are packed for permanence.',
  });
  assert.equal(edited[2].question, 'Are shipping crates archival?');
  assert.equal(edited[0].question, loaded.items[0].question);

  const toggled = updateHomepageFaqItem(edited, 1, { enabled: true });
  assert.equal(toggled[1].enabled, true);

  const moved = moveHomepageFaqItem(toggled, 2, -1);
  assert.equal(moved[1].question, 'Are shipping crates archival?');
  assert.equal(moved[2].id, loaded.items[1].id);
  assert.deepEqual(moveHomepageFaqItem(moved, 0, -1).map((item) => item.id), moved.map((item) => item.id));

  const removed = removeHomepageFaqItem(moved, 1);
  assert.equal(removed.length, 2);
  assert.equal(removed.some((item) => item.question === 'Are shipping crates archival?'), false);
  assert.equal(shouldConfirmHomepageFaqDelete(loaded.items[0]), true);
  assert.equal(shouldConfirmHomepageFaqDelete({ question: '', answer: '' }), false);
});

test('FAQ put body sends the complete document with null or numeric limit', () => {
  const numeric = homepageFaqPutBody({
    enabled: true,
    heading: '  From the atelier  ',
    subtitle: '',
    showAll: false,
    homepageLimit: 2,
    items: [
      {
        id: loaded.items[0].id,
        question: 'How is provenance recorded?',
        answer: 'Each work leaves with a certificate.',
        enabled: true,
        localKey: 'keep',
      },
      {
        question: 'Are shipping crates archival?',
        answer: 'Export crates are packed for permanence.',
        enabled: true,
        localKey: 'new',
      },
    ],
  });
  assert.deepEqual(numeric, {
    enabled: true,
    heading: 'From the atelier',
    subtitle: null,
    homepageLimit: 2,
    items: [
      {
        id: loaded.items[0].id,
        question: 'How is provenance recorded?',
        answer: 'Each work leaves with a certificate.',
        enabled: true,
      },
      {
        question: 'Are shipping crates archival?',
        answer: 'Export crates are packed for permanence.',
        enabled: true,
      },
    ],
  });
  assert.equal('localKey' in numeric.items[0], false);

  const allActive = homepageFaqPutBody({
    enabled: false,
    heading: '',
    subtitle: '',
    showAll: true,
    homepageLimit: 9,
    items: [],
  });
  assert.equal(allActive.homepageLimit, null);
  assert.equal(allActive.enabled, false);
  assert.deepEqual(allActive.items, []);
});

test('admin FAQ form and settings page follow existing save and isolation patterns', () => {
  const page = read('app/admin/settings/page.js');
  const form = read('components/homepage-faq-form.js');
  const whatsapp = read('components/whatsapp-settings-form.js');
  const hero = read('components/homepage-hero-form.js');

  assert.match(page, /WhatsappSettingsForm/);
  assert.match(page, /HomepageHeroForm/);
  assert.match(page, /HomepageFaqForm/);
  assert.match(page, /Homepage FAQ/);
  assert.match(page, /adminHomepageFaqSettings/);
  assert.match(page, /faqLoadError/);
  assert.match(page, /ErrorState error=\{faqLoadError\}/);
  assert.match(page, /HomepageFaqForm settings=\{faq\}/);
  assert.doesNotMatch(page, /faqLoadError[\s\S]{0,80}WhatsappSettingsForm/);

  assert.match(form, /Enable FAQ section/);
  assert.match(form, /Show all active FAQs/);
  assert.match(form, /Add FAQ/);
  assert.match(form, /Move up/);
  assert.match(form, /Move down/);
  assert.match(form, /Delete/);
  assert.match(form, /Save changes/);
  assert.match(form, /No FAQ items yet/);
  assert.match(form, /window\.confirm/);
  assert.match(form, /homepageFaqPutBody/);
  assert.match(form, /updateAdminHomepageFaqSettings/);
  assert.match(form, /if \(pending\)/);
  assert.match(form, /pendingButtonProps\(pending\)/);
  assert.match(form, /ActionStatus/);
  assert.match(form, /fieldsFromFaqSettings\(saved\)/);
  assert.match(form, /FAQ settings could not be saved/);
  assert.doesNotMatch(form, /catch[\s\S]*setFields\(fieldsFromFaqSettings/);
  assert.doesNotMatch(form, /Questions collectors ask/);
  assert.doesNotMatch(form, /service_role|SERVICE_ROLE|NEXT_PUBLIC_.*SERVICE/);

  assert.match(whatsapp, /updateAdminWhatsappSettings/);
  assert.doesNotMatch(whatsapp, /homepage-faq|HomepageFaq/);
  assert.doesNotMatch(hero, /homepage-faq|HomepageFaq/);
});

test('FAQ loader uses React.cache and fails closed to a disabled empty snapshot', () => {
  const loaders = read('lib/gallery-entity-loaders.js');
  assert.match(loaders, /export const loadHomepageFaq = cache\(/);
  assert.match(loaders, /getHomepageFaq/);
  assert.match(loaders, /resolveHomepageFaq\(data\)/);
  assert.match(loaders, /catch \{\s*return emptyPublicHomepageFaq\(\);/);
  assert.doesNotMatch(loaders, /unstable_cache|revalidate/);
  assert.doesNotMatch(loaders, /adminHomepageFaqSettings|admin\/settings\/homepage-faq/);

  assert.deepEqual(emptyPublicHomepageFaq(), {
    enabled: false,
    heading: null,
    subtitle: null,
    items: [],
  });
  assert.deepEqual(resolveHomepageFaq(null), emptyPublicHomepageFaq());
  assert.deepEqual(resolveHomepageFaq({
    enabled: false,
    heading: 'From the atelier',
    subtitle: 'Acquisition notes for collectors.',
    items: loaded.items,
  }), emptyPublicHomepageFaq());
});

test('public FAQ resolver keeps API order and strips admin-only fields', () => {
  const resolved = resolveHomepageFaq({
    enabled: true,
    heading: '  From the atelier  ',
    subtitle: 'Acquisition notes for collectors.',
    homepageLimit: 2,
    updatedAt: '2026-11-24T12:00:00.000Z',
    items: [
      {
        id: loaded.items[0].id,
        question: 'How is provenance recorded?',
        answer: 'Each work leaves with a certificate.\nKeep the crate.',
        enabled: true,
      },
      {
        id: loaded.items[1].id,
        question: 'Can a reserved viewing be arranged?',
        answer: 'Write to the salon with the lot reference.',
      },
    ],
  });
  assert.equal(resolved.enabled, true);
  assert.equal(resolved.heading, 'From the atelier');
  assert.equal(resolved.subtitle, 'Acquisition notes for collectors.');
  assert.equal('homepageLimit' in resolved, false);
  assert.equal('updatedAt' in resolved, false);
  assert.equal(resolved.items.length, 2);
  assert.equal(resolved.items[0].id, loaded.items[0].id);
  assert.equal(resolved.items[1].id, loaded.items[1].id);
  assert.equal(resolved.items[0].answer, 'Each work leaves with a certificate.\nKeep the crate.');
  assert.equal('enabled' in resolved.items[0], false);
});

test('disabled or empty FAQ snapshots do not render', () => {
  assert.equal(shouldRenderHomepageFaq(emptyPublicHomepageFaq()), false);
  assert.equal(shouldRenderHomepageFaq({
    enabled: true,
    heading: 'From the atelier',
    subtitle: 'Acquisition notes for collectors.',
    items: [],
  }), false);
  assert.equal(shouldRenderHomepageFaq({
    enabled: true,
    heading: 'From the atelier',
    subtitle: 'Acquisition notes for collectors.',
    items: [{ id: loaded.items[0].id, question: 'How is provenance recorded?', answer: 'Each work leaves with a certificate.' }],
  }), true);

  const component = read('components/homepage-faq.js');
  assert.match(component, /if \(!shouldRenderHomepageFaq\(faq\)\) \{\s*return null;/);
});

test('FAQ accordion renders heading, questions and independent expand state', () => {
  const component = read('components/homepage-faq.js');
  const icons = read('components/icons.js');

  assert.match(component, /\{faq\.heading\}/);
  assert.match(component, /\{faq\.subtitle\}/);
  assert.match(component, /\{item\.question\}/);
  assert.match(component, /\{item\.answer\}/);
  assert.match(component, /whitespace-pre-wrap/);
  assert.match(component, /type="button"/);
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /aria-controls=\{panelId\}/);
  assert.match(component, /toggleHomepageFaqOpenIds/);
  assert.match(component, /IconPlus/);
  assert.match(component, /IconMinus/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(component, /homepageLimit|updatedAt|updatedBy/);
  assert.doesNotMatch(component, /Questions collectors ask/);
  assert.match(icons, /export function IconPlus/);
  assert.match(icons, /export function IconMinus/);

  let openIds = new Set();
  openIds = toggleHomepageFaqOpenIds(openIds, loaded.items[0].id);
  openIds = toggleHomepageFaqOpenIds(openIds, loaded.items[1].id);
  assert.equal(openIds.has(loaded.items[0].id), true);
  assert.equal(openIds.has(loaded.items[1].id), true);
  openIds = toggleHomepageFaqOpenIds(openIds, loaded.items[0].id);
  assert.equal(openIds.has(loaded.items[0].id), false);
  assert.equal(openIds.has(loaded.items[1].id), true);
});

test('homepage FAQ sits after taxonomy and never uses admin FAQ endpoints', () => {
  const page = read('app/(gallery)/(salon)/page.js');
  const taxonomyIndex = page.indexOf('Explore by medium');
  const faqIndex = page.indexOf('<HomepageFaq faq={faq} />');
  const artistIndex = page.indexOf('<ArtistInFocus');
  const knowIndex = page.indexOf('<ArtistsToKnow');

  assert.match(page, /loadHomepageFaq\(\)/);
  assert.match(page, /<HomepageFaq faq=\{faq\} \/>/);
  assert.match(page, /The Maison manifesto/);
  assert.match(page, /Selected singular acquisitions/);
  assert.match(page, /ArtistInFocus/);
  assert.match(page, /ArtistsToKnow/);
  assert.match(page, /Explore by medium/);
  assert.ok(artistIndex > 0 && artistIndex < knowIndex);
  assert.ok(knowIndex < taxonomyIndex);
  assert.ok(taxonomyIndex > 0 && faqIndex > taxonomyIndex);
  assert.doesNotMatch(page, /adminHomepageFaqSettings|admin\/settings\/homepage-faq/);
  assert.doesNotMatch(page, /getHomepageFaq/);
});

