import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isArtworkInWishlist,
  isWishlistRemoveNotFound,
  rememberArtworkFavourite,
  rememberedArtworkFavourite,
  resolveArtworkFavouriteSaved,
  wishlistDetailCtaLabel,
  wishlistFavouriteLabel,
  wishlistLoginPath,
} from '../lib/wishlist-favourite.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('wishlist membership matches artworkId and falls back to artwork.id', () => {
  const artworkId = '8f3171f4-acbf-4024-a8d8-c7471b3644d5';
  assert.equal(isArtworkInWishlist({ items: [{ artworkId }] }, artworkId), true);
  assert.equal(
    isArtworkInWishlist({ items: [{ artwork: { id: artworkId } }] }, artworkId),
    true,
  );
  assert.equal(isArtworkInWishlist({ items: [{ artwork_id: artworkId }] }, artworkId), true);
  assert.equal(isArtworkInWishlist({ items: [{ artworkId: artworkId.toUpperCase() }] }, artworkId), true);
  assert.equal(isArtworkInWishlist({ items: [{ artworkId: 'other' }] }, artworkId), false);
  assert.equal(isArtworkInWishlist({ items: [] }, artworkId), false);
  assert.equal(isArtworkInWishlist(null, artworkId), false);
  assert.equal(isArtworkInWishlist({ items: [{ artworkId }] }, ''), false);
});

test('remembered favourite state stays filled after add even if the server snapshot is stale', () => {
  const artworkId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.equal(resolveArtworkFavouriteSaved(artworkId, false), false);
  rememberArtworkFavourite(artworkId, true);
  assert.equal(rememberedArtworkFavourite(artworkId), true);
  assert.equal(resolveArtworkFavouriteSaved(artworkId, false), true);
  rememberArtworkFavourite(artworkId, false);
  assert.equal(resolveArtworkFavouriteSaved(artworkId, true), false);
});

test('favourite labels and login next path stay on the approved copy', () => {
  assert.equal(wishlistFavouriteLabel(false), 'Save to wishlist');
  assert.equal(wishlistFavouriteLabel(true), 'Remove from wishlist');
  assert.equal(wishlistDetailCtaLabel(false), 'Save to wishlist');
  assert.equal(wishlistDetailCtaLabel(true), 'Already added to wishlist');
  assert.equal(wishlistLoginPath('/explore'), '/auth/login?next=%2Fexplore');
  assert.equal(wishlistLoginPath('/artwork/8f3171f4-acbf-4024-a8d8-c7471b3644d5'), '/auth/login?next=%2Fartwork%2F8f3171f4-acbf-4024-a8d8-c7471b3644d5');
  assert.equal(wishlistLoginPath(''), '/auth/login?next=%2F');
  assert.equal(isWishlistRemoveNotFound({ status: 404 }), true);
  assert.equal(isWishlistRemoveNotFound({ status: 500 }), false);
});

test('artwork card overlays the heart outside the image navigation link', () => {
  const card = read('components/artwork-card.js');
  assert.match(card, /showFavourite = true/);
  assert.match(card, /loadArtworkFavouriteSaved/);
  assert.match(card, /ArtworkFavouriteButton/);
  assert.match(card, /<Link href=\{`\/artwork\/\$\{artwork\.id\}`\} className="block">/);
  assert.match(card, /<\/Link>\s*\{showFavourite \? \(/);
  assert.match(card, /ArtworkFavouriteButton artworkId=\{artwork\.id\} saved=\{saved\}/);
  assert.doesNotMatch(card, /useEffect|useState|'use client'/);
});

test('favourite button toggles the existing wishlist APIs with pending and login redirect', () => {
  const button = read('components/artwork-favourite-button.js');
  assert.match(button, /'use client'/);
  assert.match(button, /type="button"/);
  assert.match(button, /addWishlistItem\(artworkId\)/);
  assert.match(button, /removeWishlistItem\(artworkId\)/);
  assert.match(button, /createBrowserArtApi/);
  assert.match(button, /requireSession/);
  assert.match(button, /usePathname/);
  assert.match(button, /wishlistLoginPath/);
  assert.match(button, /pendingButtonProps\(pending\)/);
  assert.match(button, /router\.refresh\(\)/);
  assert.match(button, /isWishlistRemoveNotFound/);
  assert.match(button, /wishlistFavouriteLabel/);
  assert.match(button, /preventDefault/);
  assert.match(button, /stopPropagation/);
  assert.match(button, /filled=\{saved\}/);
  assert.match(button, /rememberArtworkFavourite/);
  assert.match(button, /resolveArtworkFavouriteSaved/);
  assert.match(button, /data-saved/);
  assert.match(button, /artwork-favourite-button/);
  assert.match(button, /h-12 w-12/);
  assert.match(button, /is-saved/);
  assert.match(button, /pendingLabel=\{saved \? 'Saving to wishlist' : 'Removing from wishlist'\}/);
  assert.doesNotMatch(button, /artwork-favourite-button[^"]*(bg-ivory|backdrop-blur|shadow-\[)/);
  assert.doesNotMatch(button, /useQuery|QueryClient|react-query/i);

  const styles = read('app/globals.css');
  assert.match(styles, /\.artwork-favourite-button[\s\S]*background:\s*transparent/);
  assert.match(styles, /\.artwork-favourite-icon[\s\S]*drop-shadow/);
  assert.match(styles, /\.artwork-favourite-button\.is-saved[\s\S]*fill:\s*var\(--color-ivory\)/);
  assert.match(styles, /\.artwork-favourite-button\.is-saved[\s\S]*stroke:\s*var\(--color-ivory\)/);
  assert.doesNotMatch(styles, /\.artwork-favourite-button\.is-saved[\s\S]{0,400}fill:\s*var\(--color-secondary\)/);
  assert.doesNotMatch(styles, /\.artwork-favourite-button[\s\S]{0,120}background:\s*#/);
});

test('artist profile tiles show the heart and keep the availability badge off the heart', () => {
  const profile = read('components/artist-profile.js');
  assert.match(profile, /ArtworkFavouriteButton/);
  assert.match(profile, /loadArtworkFavouriteSaved/);
  assert.match(profile, /async function FeaturedWork/);
  assert.match(profile, /async function ArtistWorkTile/);
  assert.match(profile, /absolute top-3 left-3 bg-surface\/90/);
  assert.doesNotMatch(profile, /absolute top-3 right-3 bg-surface\/90/);
});

test('wishlist page hides the card heart and keeps Remove / Move to bag', () => {
  const page = read('app/(gallery)/account/wishlist/page.js');
  const actions = read('components/collection-actions.js');
  assert.match(page, /showFavourite=\{false\}/);
  assert.match(page, /WishlistItemActions/);
  assert.match(actions, /wishlistDetailCtaLabel/);
  assert.match(actions, /removeWishlistItem/);
  assert.match(actions, /moveWishlistItemToCart/);
  assert.match(actions, /Move to bag/);
  assert.doesNotMatch(actions, /ArtworkFavouriteButton/);
});

test('artwork detail CTA uses cached membership and toggles add or remove', () => {
  const detail = read('app/(gallery)/artwork/[id]/page.js');
  const actions = read('components/collection-actions.js');
  const loaders = read('lib/gallery-entity-loaders.js');

  assert.match(detail, /loadArtworkFavouriteSaved\(artwork\.id\)/);
  assert.match(detail, /AddToWishlistButton artworkId=\{artwork\.id\} saved=\{saved\} nextPath=\{`\/artwork\/\$\{artwork\.id\}`\}/);
  assert.doesNotMatch(detail, /ArtworkFavouriteButton/);
  assert.doesNotMatch(detail, /api\.getWishlist|getWishlist\(/);
  assert.doesNotMatch(detail, /loadWishlist\(/);

  assert.match(actions, /saved: savedProp = false/);
  assert.match(actions, /async function toggle\(\)/);
  assert.match(actions, /addWishlistItem\(artworkId\)/);
  assert.match(actions, /removeWishlistItem\(artworkId\)/);
  assert.match(actions, /requireSession/);
  assert.match(actions, /router\.refresh\(\)/);
  assert.match(actions, /rememberArtworkFavourite/);
  assert.match(actions, /resolveArtworkFavouriteSaved/);
  assert.match(actions, /isWishlistRemoveNotFound/);
  assert.match(actions, /wishlistLoginPath/);
  assert.match(actions, /wishlistDetailCtaLabel/);
  assert.match(actions, /IconHeart/);
  assert.match(actions, /filled=\{saved\}/);
  assert.match(actions, /artwork-wishlist-cta/);
  assert.match(actions, /saved \? 'Saving…' : 'Removing…'/);
  assert.match(actions, /pendingLabel=\{saved \? 'Saving to wishlist' : 'Removing from wishlist'\}/);
  assert.doesNotMatch(actions, /ArtworkFavouriteButton/);
  assert.doesNotMatch(actions, /wishlistFavouriteLabel/);
  assert.doesNotMatch(actions, /artwork-favourite-button/);

  assert.match(loaders, /export const loadWishlist = cache\(/);
});

test('listing cards for artists, collections and journal do not gain a heart', () => {
  const artistCard = read('components/artist-card.js');
  const journalCard = read('components/journal-card.js');
  const collections = read('app/(gallery)/collections/page.js');
  const journalListing = read('app/(gallery)/journal/page.js');
  const artistsListing = read('app/(gallery)/artists/page.js');
  const cart = read('app/(gallery)/cart/page.js');
  const checkout = read('app/(gallery)/checkout/page.js');
  const picker = read('components/collection-artwork-picker.js');

  for (const source of [
    artistCard,
    journalCard,
    collections,
    journalListing,
    artistsListing,
    cart,
    checkout,
    picker,
  ]) {
    assert.doesNotMatch(source, /ArtworkFavouriteButton|loadArtworkFavouriteSaved/);
  }
});

test('homepage explore collection and journal artwork grids still use ArtworkCard', () => {
  const home = read('app/(gallery)/(salon)/page.js');
  const explore = read('app/(gallery)/explore/page.js');
  const collection = read('app/(gallery)/collections/[id]/page.js');
  const journal = read('app/(gallery)/journal/[slug]/page.js');
  assert.match(home, /ArtworkCard/);
  assert.match(explore, /ArtworkCard/);
  assert.match(collection, /ArtworkCard/);
  assert.match(journal, /ArtworkCard/);
});
