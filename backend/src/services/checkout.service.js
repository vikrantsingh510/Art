import { and, eq, inArray } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../config/database.js';
import {
  artworks,
  cartItems,
  inventoryReservations,
  orderItems,
  orders,
} from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { isPurchasable, reservationExpiresAt } from '../utils/inventory.js';
import { lineTotalPaise, orderTotalPaise } from '../utils/money.js';
import { getAddressForUser, toShippingSnapshot } from './address.service.js';
import { getCart } from './cart.service.js';
import { expireStaleReservations, getActiveReservedQuantity } from './inventory.service.js';
import { enqueueOrderNotification } from './notification.service.js';

function buildOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MDA-${stamp}-${suffix}`;
}

function snapshotArtwork(artwork) {
  return {
    id: artwork.id,
    title: artwork.title,
    slug: artwork.slug,
    artistName: artwork.artistName,
    pricePaise: artwork.pricePaise,
    currency: artwork.currency,
    status: artwork.status,
  };
}

export async function createCheckoutOrder(userId, payload, { email } = {}) {
  const cart = await getCart(userId);
  if (cart.items.length === 0) {
    throw new ApiError(400, 'Cart is empty');
  }

  const shippingAddress = payload.shippingAddress
    ? payload.shippingAddress
    : toShippingSnapshot(await getAddressForUser(payload.addressId, userId));

  const artworkIds = cart.items.map((item) => item.artworkId);

  return db.transaction(async (tx) => {
    await expireStaleReservations(tx);

    const lockedArtworks = await tx
      .select()
      .from(artworks)
      .where(inArray(artworks.id, artworkIds))
      .for('update');

    if (lockedArtworks.length !== artworkIds.length) {
      throw new ApiError(409, 'One or more artworks are no longer available');
    }

    const lineItems = [];
    for (const artwork of lockedArtworks) {
      const reserved = await getActiveReservedQuantity(artwork.id, tx);
      if (!isPurchasable({
        status: artwork.status,
        inventoryQuantity: artwork.inventoryQuantity,
        activeReservedQuantity: reserved,
        requestedQuantity: 1,
      })) {
        throw new ApiError(409, `Artwork is not available for purchase: ${artwork.title}`);
      }

      lineItems.push({
        artwork,
        quantity: 1,
        unitPricePaise: artwork.pricePaise,
        totalPricePaise: lineTotalPaise(1, artwork.pricePaise),
      });
    }

    const subtotalPaise = lineItems.reduce((sum, item) => sum + item.totalPricePaise, 0);
    const shippingPaise = 0;
    const taxPaise = 0;
    const discountPaise = 0;
    const totalPaise = orderTotalPaise({
      subtotalPaise,
      shippingPaise,
      taxPaise,
      discountPaise,
    });

    const [order] = await tx.insert(orders).values({
      orderNumber: buildOrderNumber(),
      userId,
      status: 'pending_payment',
      subtotalPaise,
      shippingPaise,
      discountPaise,
      taxPaise,
      totalPaise,
      currency: 'INR',
      shippingAddressSnapshot: shippingAddress,
      notes: payload.notes ?? null,
    }).returning();

    await tx.insert(orderItems).values(lineItems.map((item) => ({
      orderId: order.id,
      artworkId: item.artwork.id,
      artworkTitle: item.artwork.title,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      totalPricePaise: item.totalPricePaise,
      artworkSnapshot: snapshotArtwork(item.artwork),
    })));

    const expiresAt = reservationExpiresAt(new Date(), env.RESERVATION_TTL_SECONDS);
    await tx.insert(inventoryReservations).values(lineItems.map((item) => ({
      artworkId: item.artwork.id,
      orderId: order.id,
      quantity: item.quantity,
      status: 'active',
      expiresAt,
    })));

    await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));

    await enqueueOrderNotification({
      userId,
      orderId: order.id,
      eventType: 'order.pending_payment',
      recipientEmail: email,
      payload: {
        email,
        orderNumber: order.orderNumber,
        totalPaise: order.totalPaise,
      },
    }, tx);

    return {
      ...order,
      items: lineItems.map((item) => ({
        artworkId: item.artwork.id,
        artworkTitle: item.artwork.title,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        totalPricePaise: item.totalPricePaise,
      })),
      reservationExpiresAt: expiresAt,
    };
  });
}

export async function getOrderForUser(orderId, userId, { isAdmin = false } = {}) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || (!isAdmin && order.userId !== userId)) {
    throw new ApiError(404, 'Order not found');
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const reservations = await db
    .select()
    .from(inventoryReservations)
    .where(eq(inventoryReservations.orderId, orderId));

  return { ...order, items, reservations };
}

export async function listOrdersForUser(userId) {
  const rows = await db.select().from(orders).where(eq(orders.userId, userId));
  return rows;
}

export async function convertReservationsForCapturedPayment(orderId, executor = db) {
  const active = await executor
    .select()
    .from(inventoryReservations)
    .where(and(
      eq(inventoryReservations.orderId, orderId),
      eq(inventoryReservations.status, 'active'),
    ));

  for (const reservation of active) {
    const [artwork] = await executor
      .select()
      .from(artworks)
      .where(eq(artworks.id, reservation.artworkId))
      .for('update');

    const nextQuantity = Math.max(0, artwork.inventoryQuantity - reservation.quantity);
    await executor.update(artworks).set({
      inventoryQuantity: nextQuantity,
      status: nextQuantity === 0 ? 'sold' : artwork.status,
    }).where(eq(artworks.id, reservation.artworkId));

    await executor.update(inventoryReservations).set({
      status: 'converted',
    }).where(eq(inventoryReservations.id, reservation.id));
  }

  await executor.update(orders).set({
    status: 'confirmed',
  }).where(and(
    eq(orders.id, orderId),
    eq(orders.status, 'pending_payment'),
  ));

  const [order] = await executor.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (order) {
    await enqueueOrderNotification({
      userId: order.userId,
      orderId: order.id,
      eventType: 'order.confirmed',
      payload: {
        orderNumber: order.orderNumber,
        totalPaise: order.totalPaise,
      },
    }, executor);
  }
}

export default {
  createCheckoutOrder,
  getOrderForUser,
  listOrdersForUser,
  convertReservationsForCapturedPayment,
};
