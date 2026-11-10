import { and, eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { wishlistItems, wishlists } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { addCartItem } from './cart.service.js';
import { getArtworkById } from './artwork.service.js';
import { hydrateCollectionItems } from './item-hydrate.js';

export async function getOrCreateWishlist(userId) {
  const [existing] = await db.select().from(wishlists).where(eq(wishlists.userId, userId)).limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db.insert(wishlists).values({ userId }).returning();
  return created;
}

export async function getWishlist(userId) {
  const wishlist = await getOrCreateWishlist(userId);
  const items = await db.select().from(wishlistItems).where(eq(wishlistItems.wishlistId, wishlist.id));
  const detailedItems = await hydrateCollectionItems(items);

  return {
    id: wishlist.id,
    items: detailedItems,
    count: detailedItems.length,
  };
}

export async function addWishlistItem(userId, artworkId) {
  const artwork = await getArtworkById(artworkId, { publicOnly: false });
  if (artwork.status === 'draft') {
    throw new ApiError(404, 'Artwork not found');
  }

  const wishlist = await getOrCreateWishlist(userId);
  const [created] = await db.insert(wishlistItems).values({
    wishlistId: wishlist.id,
    artworkId,
  }).onConflictDoNothing().returning();

  if (!created) {
    const [existing] = await db.select().from(wishlistItems).where(and(
      eq(wishlistItems.wishlistId, wishlist.id),
      eq(wishlistItems.artworkId, artworkId),
    )).limit(1);
    return existing;
  }

  return created;
}

export async function removeWishlistItem(userId, artworkId) {
  const wishlist = await getOrCreateWishlist(userId);
  const deleted = await db.delete(wishlistItems).where(and(
    eq(wishlistItems.wishlistId, wishlist.id),
    eq(wishlistItems.artworkId, artworkId),
  )).returning();

  if (deleted.length === 0) {
    throw new ApiError(404, 'Wishlist item not found');
  }

  return deleted[0];
}

export async function moveWishlistItemToCart(userId, artworkId) {
  const wishlist = await getOrCreateWishlist(userId);
  const [existing] = await db.select().from(wishlistItems).where(and(
    eq(wishlistItems.wishlistId, wishlist.id),
    eq(wishlistItems.artworkId, artworkId),
  )).limit(1);

  if (!existing) {
    throw new ApiError(404, 'Wishlist item not found');
  }

  const cartItem = await addCartItem(userId, artworkId);
  await db.delete(wishlistItems).where(and(
    eq(wishlistItems.wishlistId, wishlist.id),
    eq(wishlistItems.artworkId, artworkId),
  ));

  return cartItem;
}

export default {
  getOrCreateWishlist,
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  moveWishlistItemToCart,
};
