import { and, eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { cartItems, carts } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { getArtworkById } from './artwork.service.js';
import { hydrateCollectionItems } from './item-hydrate.js';

export async function getOrCreateCart(userId) {
  const [existing] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db.insert(carts).values({ userId }).returning();
  return created;
}

export async function getCart(userId) {
  const cart = await getOrCreateCart(userId);
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
  const detailedItems = await hydrateCollectionItems(items);

  return {
    id: cart.id,
    items: detailedItems,
    count: detailedItems.length,
  };
}

export async function addCartItem(userId, artworkId) {
  const artwork = await getArtworkById(artworkId, { publicOnly: true });
  if (!artwork.isPurchasable) {
    throw new ApiError(409, 'Artwork is not available for purchase');
  }

  const cart = await getOrCreateCart(userId);
  const [created] = await db.insert(cartItems).values({
    cartId: cart.id,
    artworkId,
  }).onConflictDoNothing().returning();

  if (!created) {
    const [existing] = await db.select().from(cartItems).where(and(
      eq(cartItems.cartId, cart.id),
      eq(cartItems.artworkId, artworkId),
    )).limit(1);
    return existing;
  }

  return created;
}

export async function removeCartItem(userId, artworkId) {
  const cart = await getOrCreateCart(userId);
  const deleted = await db.delete(cartItems).where(and(
    eq(cartItems.cartId, cart.id),
    eq(cartItems.artworkId, artworkId),
  )).returning();

  if (deleted.length === 0) {
    throw new ApiError(404, 'Cart item not found');
  }

  return deleted[0];
}

export default {
  getOrCreateCart,
  getCart,
  addCartItem,
  removeCartItem,
};
