import { and, eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { cartItems, carts } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { getArtworkById } from './artwork.service.js';
import { hydrateCollectionItems } from './item-hydrate.js';

export async function getOrCreateCart(userId, executor = db) {
  const [existing] = await executor.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await executor.insert(carts).values({ userId }).onConflictDoNothing().returning();
  if (created) {
    return created;
  }

  const [raced] = await executor.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  return raced;
}

export async function lockCartForUser(userId, executor) {
  const [cart] = await executor
    .select()
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1)
    .for('update');

  if (cart && cart.userId !== userId) {
    return null;
  }

  return cart || null;
}

export async function lockOrCreateCartForUser(userId, executor) {
  const existing = await lockCartForUser(userId, executor);
  if (existing) {
    return existing;
  }

  await executor.insert(carts).values({ userId }).onConflictDoNothing();
  return lockCartForUser(userId, executor);
}

export async function listCartItemsForCart(cartId, executor) {
  return executor.select().from(cartItems).where(eq(cartItems.cartId, cartId));
}

export async function getCart(userId) {
  const cart = await getOrCreateCart(userId);
  const items = await listCartItemsForCart(cart.id, db);
  const detailedItems = await hydrateCollectionItems(items);

  return {
    id: cart.id,
    items: detailedItems,
    count: detailedItems.length,
  };
}

export async function addCartItem(userId, artworkId, {
  loadArtwork,
  lockCart = lockOrCreateCartForUser,
  runTransaction = (callback) => db.transaction(callback),
} = {}) {
  const artwork = loadArtwork
    ? await loadArtwork(artworkId)
    : await getArtworkById(artworkId, { publicOnly: true });
  if (!artwork.isPurchasable) {
    throw new ApiError(409, 'Artwork is not available for purchase');
  }

  return runTransaction(async (tx) => {
    const cart = await lockCart(userId, tx);
    if (!cart || cart.userId !== userId) {
      throw new ApiError(500, 'Unable to resolve cart');
    }

    const [created] = await tx.insert(cartItems).values({
      cartId: cart.id,
      artworkId,
    }).onConflictDoNothing().returning();

    if (!created) {
      const [existing] = await tx.select().from(cartItems).where(and(
        eq(cartItems.cartId, cart.id),
        eq(cartItems.artworkId, artworkId),
      )).limit(1);
      return existing;
    }

    return created;
  });
}

export async function removeCartItem(userId, artworkId, {
  lockCart = lockOrCreateCartForUser,
  runTransaction = (callback) => db.transaction(callback),
} = {}) {
  return runTransaction(async (tx) => {
    const cart = await lockCart(userId, tx);
    if (!cart || cart.userId !== userId) {
      throw new ApiError(404, 'Cart item not found');
    }

    const deleted = await tx.delete(cartItems).where(and(
      eq(cartItems.cartId, cart.id),
      eq(cartItems.artworkId, artworkId),
    )).returning();

    if (deleted.length === 0) {
      throw new ApiError(404, 'Cart item not found');
    }

    return deleted[0];
  });
}

export default {
  getOrCreateCart,
  lockCartForUser,
  lockOrCreateCartForUser,
  listCartItemsForCart,
  getCart,
  addCartItem,
  removeCartItem,
};
