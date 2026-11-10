import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { orders, shipments } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { enqueueOrderNotification } from './notification.service.js';
import { writeAuditLog } from './audit.service.js';

const ORDER_STATUS_FOR_SHIPMENT = {
  pending: 'processing',
  packed: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
  returned: 'refund_pending',
};

export async function listShipments(orderId) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  const items = await db.select().from(shipments).where(eq(shipments.orderId, orderId));
  return { order, shipments: items };
}

export async function createShipment(orderId, payload, actorUserId) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  if (!['confirmed', 'processing', 'shipped'].includes(order.status)) {
    throw new ApiError(409, 'Order is not ready for fulfilment');
  }

  const [created] = await db.insert(shipments).values({
    orderId,
    courierName: payload.courierName ?? null,
    trackingNumber: payload.trackingNumber ?? null,
    trackingUrl: payload.trackingUrl ?? null,
    status: payload.status || 'pending',
    shippedAt: payload.status === 'shipped' ? new Date() : null,
    deliveredAt: payload.status === 'delivered' ? new Date() : null,
  }).returning();

  await syncOrderFulfilment(orderId, created.status);
  await writeAuditLog({
    actorUserId,
    action: 'shipment.create',
    entityType: 'order',
    entityId: orderId,
    metadata: { shipmentId: created.id },
  });

  return created;
}

export async function updateShipment(shipmentId, payload, actorUserId) {
  const [existing] = await db.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  if (!existing) {
    throw new ApiError(404, 'Shipment not found');
  }

  const nextStatus = payload.status || existing.status;
  const [updated] = await db.update(shipments).set({
    ...payload,
    shippedAt: nextStatus === 'shipped' ? (existing.shippedAt || new Date()) : existing.shippedAt,
    deliveredAt: nextStatus === 'delivered' ? (existing.deliveredAt || new Date()) : existing.deliveredAt,
  }).where(eq(shipments.id, shipmentId)).returning();

  await syncOrderFulfilment(existing.orderId, nextStatus);
  await writeAuditLog({
    actorUserId,
    action: 'shipment.update',
    entityType: 'shipment',
    entityId: shipmentId,
    metadata: { status: nextStatus },
  });

  if (nextStatus === 'shipped' || nextStatus === 'delivered') {
    const [order] = await db.select().from(orders).where(eq(orders.id, existing.orderId)).limit(1);
    await enqueueOrderNotification({
      userId: order?.userId,
      orderId: existing.orderId,
      eventType: `shipment.${nextStatus}`,
      payload: {
        shipmentId,
        trackingNumber: updated.trackingNumber,
        email: undefined,
      },
    });
  }

  return updated;
}

async function syncOrderFulfilment(orderId, shipmentStatus) {
  const nextOrderStatus = ORDER_STATUS_FOR_SHIPMENT[shipmentStatus];
  if (!nextOrderStatus) {
    return;
  }

  await db.update(orders).set({ status: nextOrderStatus }).where(eq(orders.id, orderId));
}

export default {
  listShipments,
  createShipment,
  updateShipment,
};
