import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { inventoryReservations, orders, payments } from '../db/schema/index.js';
import { availableQuantity } from '../utils/inventory.js';

const UNRESOLVED_PAYMENT_STATUSES = ['authorized'];

export async function getActiveReservedQuantity(artworkId, executor = db) {
  const [row] = await executor
    .select({
      reserved: sql`coalesce(sum(${inventoryReservations.quantity}), 0)::int`.as('reserved'),
    })
    .from(inventoryReservations)
    .where(and(
      eq(inventoryReservations.artworkId, artworkId),
      eq(inventoryReservations.status, 'active'),
    ));

  return Number(row?.reserved || 0);
}

export async function getActiveReservedQuantities(artworkIds, executor = db) {
  if (artworkIds.length === 0) {
    return new Map();
  }

  const rows = await executor
    .select({
      artworkId: inventoryReservations.artworkId,
      reserved: sql`coalesce(sum(${inventoryReservations.quantity}), 0)::int`.as('reserved'),
    })
    .from(inventoryReservations)
    .where(and(
      inArray(inventoryReservations.artworkId, artworkIds),
      eq(inventoryReservations.status, 'active'),
    ))
    .groupBy(inventoryReservations.artworkId);

  return new Map(rows.map((row) => [row.artworkId, Number(row.reserved || 0)]));
}

export function withAvailability(artwork, reservedQuantity = 0) {
  const available = availableQuantity(artwork.inventoryQuantity, reservedQuantity);
  return {
    ...artwork,
    reservedQuantity,
    availableQuantity: available,
    isPurchasable: artwork.status === 'published' && available > 0,
  };
}

export async function expireStaleReservations(executor = db, now = new Date()) {
  const stale = await executor
    .select({
      id: inventoryReservations.id,
      orderId: inventoryReservations.orderId,
    })
    .from(inventoryReservations)
    .innerJoin(orders, eq(orders.id, inventoryReservations.orderId))
    .where(and(
      eq(inventoryReservations.status, 'active'),
      lt(inventoryReservations.expiresAt, now),
    ));

  if (stale.length === 0) {
    return [];
  }

  const orderIds = [...new Set(stale.map((row) => row.orderId))];
  const unresolvedPayments = await executor
    .select({
      orderId: payments.orderId,
    })
    .from(payments)
    .where(and(
      inArray(payments.orderId, orderIds),
      inArray(payments.status, UNRESOLVED_PAYMENT_STATUSES),
    ));

  const blockedOrderIds = new Set(unresolvedPayments.map((row) => row.orderId));
  const expired = stale.filter((row) => !blockedOrderIds.has(row.orderId));

  if (expired.length === 0) {
    return [];
  }

  const reservationIds = expired.map((row) => row.id);
  const expiredOrderIds = [...new Set(expired.map((row) => row.orderId))];

  await executor
    .update(inventoryReservations)
    .set({ status: 'expired' })
    .where(inArray(inventoryReservations.id, reservationIds));

  await executor
    .update(orders)
    .set({ status: 'cancelled' })
    .where(and(
      inArray(orders.id, expiredOrderIds),
      eq(orders.status, 'pending_payment'),
    ));

  return expired;
}

export default {
  getActiveReservedQuantity,
  getActiveReservedQuantities,
  withAvailability,
  expireStaleReservations,
};
