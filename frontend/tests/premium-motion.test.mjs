import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { bindArtworkImageReady, isArtworkImageCached } from '../lib/artwork-image-ready.js';
import {
  clampRevealStagger,
  observeReveal,
  resetRevealObserver,
  REVEAL_STAGGER_LIMIT,
  REVEAL_STAGGER_MS,
} from '../lib/reveal-observer.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function mockImage({ complete = false, naturalWidth = 0 } = {}) {
  const classNames = new Set();
  const listeners = new Map();
  return {
    complete,
    naturalWidth,
    classList: {
      add: (...names) => names.forEach((name) => classNames.add(name)),
      remove: (...names) => names.forEach((name) => classNames.delete(name)),
      contains: (name) => classNames.has(name),
    },
    addEventListener(type, handler) {
      const current = listeners.get(type) || [];
      current.push(handler);
      listeners.set(type, current);
    },
    removeEventListener(type, handler) {
      const current = listeners.get(type) || [];
      listeners.set(type, current.filter((item) => item !== handler));
    },
    emit(type) {
      (listeners.get(type) || []).forEach((handler) => handler());
    },
  };
}

function mockElement({ top = 1200, bottom = 1500 } = {}) {
  const classNames = new Set();
  return {
    classList: {
      add: (name) => classNames.add(name),
      contains: (name) => classNames.has(name),
    },
    getBoundingClientRect: () => ({ top, bottom, left: 0, right: 320, width: 320, height: 300 }),
  };
}

class FakeIntersectionObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element) {
    this.observed.push(element);
  }

  unobserve(element) {
    this.observed = this.observed.filter((item) => item !== element);
  }

  disconnect() {
    this.observed = [];
  }

  trigger(entries) {
    this.callback(entries, this);
  }
}

test('artwork image ready-state handles load, cache and priority without extra React state', () => {
  const image = read('components/artwork-image.js');
  const helper = read('lib/artwork-image-ready.js');
  const styles = read('app/globals.css');

  const fade = read('components/artwork-image-fade.js');
  assert.match(image, /ArtworkImageFade/);
  assert.match(image, /priority \? ' is-ready'/);
  assert.match(image, /hover \? ' artwork-image-hover'/);
  assert.match(image, /object-contain/);
  assert.match(fade, /bindArtworkImageReady/);
  assert.doesNotMatch(fade, /useState/);
  assert.match(helper, /isArtworkImageCached/);
  assert.match(helper, /classList\.add\('is-ready'\)/);
  assert.match(styles, /\.artwork-image-fade\.is-awaiting:not\(\.is-ready\)[\s\S]*opacity:\s*0/);
  assert.match(styles, /\.artwork-image-fade \{[\s\S]*opacity:\s*1/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*\.artwork-image-fade[\s\S]*opacity:\s*1/);

  const cached = mockImage({ complete: true, naturalWidth: 800 });
  assert.equal(isArtworkImageCached(cached), true);
  bindArtworkImageReady(cached);
  assert.equal(cached.classList.contains('is-ready'), true);
  assert.equal(cached.classList.contains('is-awaiting'), false);

  const pending = mockImage();
  bindArtworkImageReady(pending);
  assert.equal(pending.classList.contains('is-awaiting'), true);
  assert.equal(pending.classList.contains('is-ready'), false);
  pending.emit('load');
  assert.equal(pending.classList.contains('is-ready'), true);
  assert.equal(pending.classList.contains('is-awaiting'), false);

  const broken = mockImage();
  bindArtworkImageReady(broken);
  broken.emit('error');
  assert.equal(broken.classList.contains('is-ready'), true);

  const priority = mockImage();
  bindArtworkImageReady(priority, { priority: true });
  assert.equal(priority.classList.contains('is-ready'), true);
  assert.equal(priority.classList.contains('is-awaiting'), false);
});

test('shared reveal stays visible without JS and respects reduced motion', () => {
  const reveal = read('components/reveal.js');
  const observer = read('lib/reveal-observer.js');
  const styles = read('app/globals.css');
  const page = read('app/(gallery)/(salon)/page.js');

  assert.match(reveal, /'use client'/);
  assert.match(reveal, /observeReveal/);
  assert.match(reveal, /useLayoutEffect/);
  assert.doesNotMatch(reveal, /opacity-0|translate-y/);
  assert.match(observer, /IntersectionObserver/);
  assert.match(observer, /unobserve/);
  assert.equal(REVEAL_STAGGER_LIMIT, 3);
  assert.equal(REVEAL_STAGGER_MS, 60);
  assert.equal(clampRevealStagger(8), 3);
  assert.equal(clampRevealStagger(0), 0);

  assert.match(styles, /\.reveal \{\s*opacity:\s*1/);
  assert.match(styles, /\.reveal\.reveal-ready:not\(\.is-revealed\)[\s\S]*opacity:\s*0/);
  assert.match(styles, /translateY\(var\(--motion-distance\)\)/);
  assert.match(styles, /var\(--motion-slow\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*\.reveal[\s\S]*opacity:\s*1/);
  assert.doesNotMatch(styles, /\.reveal\s*\{[^}]*opacity:\s*0/);

  assert.match(page, /<Reveal className="grid md:grid-cols-2 gap-16" stagger=\{2\}>/);
  assert.match(page, /Selected singular acquisitions/);
  assert.match(page, /<Reveal stagger=\{2\}>/);
  assert.match(page, /hero-copy/);
  assert.match(page, /shouldRenderHomepageFaq\(faq\)/);
  assert.doesNotMatch(page, /'use client'/);
  assert.doesNotMatch(page, /<Reveal>[\s\S]*<ArtworkCard/);
});

test('hero copy entrance does not zoom the banner or drop priority loading', () => {
  const page = read('app/(gallery)/(salon)/page.js');
  const styles = read('app/globals.css');

  assert.match(page, /priority/);
  assert.match(page, /sizes="100vw"/);
  assert.match(page, /hero-copy/);
  assert.doesNotMatch(page, /hero-copy[\s\S]*scale\(/);
  assert.doesNotMatch(page, /parallax/);
  assert.match(styles, /@keyframes\s+hero-copy-enter/);
  assert.match(styles, /hero-copy-enter 320ms var\(--motion-ease\)/);
  assert.match(styles, /translateY\(8px\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*\.hero-copy/);
  assert.doesNotMatch(styles, /hero-frame[\s\S]{0,200}scale\(/);
});

test('editorial image hover is clipped and does not change artwork card dimensions', () => {
  const focus = read('components/artist-in-focus.js');
  const know = read('components/artists-to-know.js');
  const journal = read('components/journal-card.js');
  const artistCard = read('components/artist-card.js');
  const collections = read('app/(gallery)/collections/page.js');
  const page = read('app/(gallery)/(salon)/page.js');
  const showcase = read('components/homepage-collection-showcase.js');
  const card = read('components/artwork-card.js');
  const styles = read('app/globals.css');

  assert.match(focus, /editorial-image-hover/);
  assert.match(know, /editorial-image-hover/);
  assert.match(journal, /editorial-image-hover/);
  assert.match(artistCard, /editorial-image-hover/);
  assert.match(collections, /editorial-image-hover/);
  assert.match(page, /HomepageCollectionShowcase/);
  assert.match(showcase, /homepage-collection-panel/);
  assert.doesNotMatch(card, /editorial-image-hover/);
  assert.match(styles, /@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\)[\s\S]*\.editorial-image-hover:hover img[\s\S]*scale\(1\.02\)/);
  assert.match(styles, /\.editorial-image-hover \{\s*overflow:\s*hidden/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*\.editorial-image-hover:hover img[\s\S]*transform:\s*none/);
  assert.match(styles, /\.homepage-collection-panel[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\)[\s\S]*scale\(1\.03\)/);
  assert.match(card, /fit="physical"/);
  assert.match(card, /hover=\{false\}/);
});

test('observeReveal uses one observer, reveals once, and never hides reduced-motion content', () => {
  resetRevealObserver();
  FakeIntersectionObserver.instances = [];
  globalThis.IntersectionObserver = FakeIntersectionObserver;
  globalThis.innerHeight = 800;
  globalThis.matchMedia = () => ({ matches: false });

  const belowFold = mockElement({ top: 1200, bottom: 1500 });
  const cleanup = observeReveal(belowFold);
  assert.equal(belowFold.classList.contains('reveal-ready'), true);
  assert.equal(belowFold.classList.contains('is-revealed'), false);
  assert.equal(FakeIntersectionObserver.instances.length, 1);
  const shared = FakeIntersectionObserver.instances[0];
  assert.equal(shared.observed.includes(belowFold), true);

  const second = mockElement({ top: 1400, bottom: 1700 });
  observeReveal(second);
  assert.equal(FakeIntersectionObserver.instances.length, 1);
  assert.equal(shared.observed.length, 2);

  shared.trigger([{ isIntersecting: true, target: belowFold }]);
  assert.equal(belowFold.classList.contains('is-revealed'), true);
  assert.equal(shared.observed.includes(belowFold), false);

  cleanup();
  resetRevealObserver();

  globalThis.matchMedia = () => ({ matches: true });
  const reduced = mockElement({ top: 1200, bottom: 1500 });
  observeReveal(reduced);
  assert.equal(reduced.classList.contains('is-revealed'), true);
  assert.equal(reduced.classList.contains('reveal-ready'), false);

  delete globalThis.IntersectionObserver;
  delete globalThis.matchMedia;
  delete globalThis.innerHeight;
});

test('collection journal and artist surfaces reuse shared motion without wrapping every artwork card', () => {
  const listing = read('app/(gallery)/collections/page.js');
  const detail = read('app/(gallery)/collections/[id]/page.js');
  const journal = read('app/(gallery)/journal/page.js');
  const journalDetail = read('app/(gallery)/journal/[slug]/page.js');
  const journalCard = read('components/journal-card.js');
  const artists = read('app/(gallery)/artists/page.js');
  const artistCard = read('components/artist-card.js');
  const profile = read('components/artist-profile.js');
  const styles = read('app/globals.css');

  assert.match(listing, /editorial-image-hover/);
  assert.match(listing, /editorial-card-link/);
  assert.match(listing, /href=\{`\/collections\/\$\{collection\.id\}`\}/);
  assert.match(detail, /sortByCollectionOrder/);
  assert.match(detail, /editorial-image-hover/);
  assert.match(detail, /<ArtworkCard key=\{artwork\.id\} artwork=\{artwork\} \/>/);
  assert.doesNotMatch(detail, /<Reveal>[\s\S]{0,120}<ArtworkCard/);
  assert.match(journal, /Reveal/);
  assert.match(journalCard, /editorial-card-title/);
  assert.match(journalCard, /editorial-image-hover/);
  assert.match(journalDetail, /priority/);
  assert.match(journalDetail, /<MarkdownBody markdown=\{blog\.body\} \/>/);
  assert.doesNotMatch(journalDetail, /split\('\n'\)|line-by-line/);
  assert.match(artists, /Reveal/);
  assert.match(artistCard, /editorial-card-title/);
  assert.match(profile, /editorial-image-hover/);
  assert.match(profile, /artwork-contain-hover/);
  assert.match(profile, /object-contain/);
  assert.doesNotMatch(profile.split('async function FeaturedWork')[1].split('async function ArtistWorkTile')[0], /artwork-image-hover/);
  assert.doesNotMatch(profile.split('async function ArtistWorkTile')[1].split('function PeerArtist')[0], /artwork-image-hover/);
  assert.match(styles, /\.editorial-card-title[\s\S]*var\(--motion-fast\)/);
  assert.match(styles, /@media \(hover: hover\)[\s\S]*\.editorial-card-link:hover \.editorial-card-title/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*\.editorial-card-title/);
  assert.match(styles, /\.artwork-contain-hover:hover img[\s\S]*filter:\s*brightness/);
});

test('batch D explore account and cart motion stay opacity-safe and reduced-motion aware', () => {
  const styles = read('app/globals.css');
  const filters = read('components/explore-filters.js');
  const pending = read('components/explore-pending.js');
  const states = read('components/states.js');
  const accountNav = read('components/account-nav.js');
  const account = read('app/(gallery)/account/page.js');
  const cart = read('app/(gallery)/cart/page.js');
  const checkout = read('app/(gallery)/checkout/page.js');
  const orders = read('app/(gallery)/account/orders/page.js');
  const explorePage = read('app/(gallery)/explore/page.js');

  assert.match(styles, /\.field-input[\s\S]*transition:\s*border-color var\(--motion\)/);
  assert.match(styles, /\.explore-filter-chip[\s\S]*transition:\s*border-color var\(--motion\)/);
  assert.match(styles, /\.explore-results\.is-pending[\s\S]*opacity:\s*0\.72/);
  assert.match(styles, /@keyframes\s+salon-empty-enter/);
  assert.match(styles, /\.empty-state[\s\S]*salon-empty-enter 220ms var\(--motion-ease\)/);
  assert.match(styles, /\.account-nav-link[\s\S]*var\(--motion-fast\)/);
  assert.match(styles, /\.salon-title-link[\s\S]*var\(--motion-fast\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*\.empty-state/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*\.explore-results\.is-pending[\s\S]*opacity:\s*1/);
  assert.doesNotMatch(styles, /@keyframes\s+shimmer/i);
  assert.doesNotMatch(styles, /animate-spin/);
  assert.doesNotMatch(styles, /\.explore-results[\s\S]{0,200}scale\(/);

  assert.match(filters, /aria-busy=\{pending\}/);
  assert.match(pending, /aria-busy=\{pending\}/);
  assert.match(states, /empty-state/);
  assert.match(accountNav, /account-nav-link/);
  assert.match(accountNav, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(account, /editorial-card-link/);
  assert.match(account, /editorial-card-title/);
  assert.match(cart, /salon-title-link/);
  assert.match(cart, /loadCart\(\)/);
  assert.match(cart, /Reservation total \{formatInrFromPaise\(total\)\}/);
  assert.doesNotMatch(cart, /requestAnimationFrame|countUp/);
  assert.match(checkout, /CheckoutForm/);
  assert.match(checkout, /EmptyState/);
  assert.doesNotMatch(checkout, /requestAnimationFrame/);
  assert.match(orders, /salon-title-link/);
  assert.match(explorePage, /<ArtworkCard key=\{artwork\.id\} artwork=\{artwork\} \/>/);
  assert.doesNotMatch(explorePage, /scale-|hover:scale/);
});
