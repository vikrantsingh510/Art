import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../config/database.js';
import { orders, payments, refunds, webhookEvents } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { convertReservationsForCapturedPayment, getOrderForUser } from './checkout.service.js';
import { enqueueOrderNotification } from './notification.service.js';
import { writeAuditLog } from './audit.service.js';

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';
const RAZORPAY_REFUNDS_URL = 'https://api.razorpay.com/v1/payments';

export function isRazorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export function isRazorpayWebhookConfigured() {
  return Boolean(env.RAZORPAY_WEBHOOK_SECRET);
}

function requireRazorpay() {
  if (!isRazorpayConfigured()) {
    throw new ApiError(503, 'Payment provider is not configured');
  }
}

function razorpayAuthHeader() {
  const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

export function verifyRazorpayWebhookSignature(rawBody, signature, secret = env.RAZORPAY_WEBHOOK_SECRET) {
  if (!secret || !signature || !rawBody) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(String(signature));
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function hashPayload(rawBody) {
  return createHmac('sha256', 'payload').update(rawBody).digest('hex');
}

export async function initiatePayment(orderId, userId) {
  const order = await getOrderForUser(orderId, userId);
  if (order.status !== 'pending_payment') {
    throw new ApiError(409, 'Order is not awaiting payment');
  }

  requireRazorpay();

  const [existing] = await db.select().from(payments).where(and(
    eq(payments.orderId, orderId),
    eq(payments.status, 'created'),
  )).limit(1);

  if (existing?.providerOrderId) {
    return {
      payment: existing,
      razorpayKeyId: env.RAZORPAY_KEY_ID,
      razorpayOrderId: existing.providerOrderId,
    };
  }

  const response = await fetch(RAZORPAY_ORDERS_URL, {
    method: 'POST',
    headers: {
      Authorization: razorpayAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: order.totalPaise,
      currency: order.currency,
      receipt: order.orderNumber,
      notes: {
        orderId: order.id,
      },
    }),
  });

  if (!response.ok) {
    throw new ApiError(502, 'Unable to create payment order');
  }

  const providerOrder = await response.json();
  const [payment] = await db.insert(payments).values({
    orderId,
    provider: 'razorpay',
    providerOrderId: providerOrder.id,
    amountPaise: order.totalPaise,
    currency: order.currency,
    status: 'created',
  }).returning();

  return {
    payment,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: providerOrder.id,
  };
}

export async function capturePaymentForOrder({
  orderId,
  providerPaymentId,
  providerOrderId,
  amountPaise,
}) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    const [existingByProvider] = providerPaymentId
      ? await tx.select().from(payments).where(eq(payments.providerPaymentId, providerPaymentId)).limit(1)
      : [];

    if (existingByProvider?.status === 'captured') {
      return existingByProvider;
    }

    let [payment] = await tx.select().from(payments).where(and(
      eq(payments.orderId, orderId),
      eq(payments.providerOrderId, providerOrderId || ''),
    )).limit(1);

    if (!payment) {
      [payment] = await tx.insert(payments).values({
        orderId,
        provider: 'razorpay',
        providerOrderId: providerOrderId || null,
        providerPaymentId: providerPaymentId || null,
        amountPaise: amountPaise || order.totalPaise,
        currency: order.currency,
        status: 'captured',
        capturedAt: new Date(),
      }).returning();
    } else if (payment.status !== 'captured') {
      [payment] = await tx.update(payments).set({
        providerPaymentId: providerPaymentId || payment.providerPaymentId,
        status: 'captured',
        capturedAt: new Date(),
      }).where(eq(payments.id, payment.id)).returning();
    }

    await convertReservationsForCapturedPayment(orderId, tx);
    return payment;
  });
}

export async function processRazorpayWebhook(rawBody, signature, parsedBody) {
  if (!isRazorpayWebhookConfigured()) {
    throw new ApiError(503, 'Payment webhook is not configured');
  }

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    throw new ApiError(401, 'Invalid webhook signature');
  }

  const eventId = parsedBody.event_id || parsedBody.id || parsedBody.payload?.payment?.entity?.id || randomUUID();
  const eventType = parsedBody.event || 'unknown';
  const payloadHash = hashPayload(rawBody);

  try {
    await db.insert(webhookEvents).values({
      provider: 'razorpay',
      providerEventId: String(eventId),
      eventType,
      processingStatus: 'processing',
      payloadHash,
    });
  } catch (error) {
    if (String(error?.code) === '23505') {
      return { duplicate: true };
    }
    throw error;
  }

  try {
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const entity = parsedBody.payload?.payment?.entity || parsedBody.payload?.order?.entity || {};
      const orderId = entity.notes?.orderId;
      if (orderId) {
        await capturePaymentForOrder({
          orderId,
          providerPaymentId: entity.id,
          providerOrderId: entity.order_id,
          amountPaise: entity.amount,
        });
      }
    }

    if (eventType === 'refund.processed') {
      const entity = parsedBody.payload?.refund?.entity || {};
      if (entity.id) {
        await db.update(refunds).set({
          status: 'succeeded',
          refundedAt: new Date(),
        }).where(eq(refunds.providerRefundId, entity.id));
      }
    }

    await db.update(webhookEvents).set({
      processingStatus: 'processed',
      processedAt: new Date(),
    }).where(and(
      eq(webhookEvents.provider, 'razorpay'),
      eq(webhookEvents.providerEventId, String(eventId)),
    ));

    return { duplicate: false };
  } catch (error) {
    await db.update(webhookEvents).set({
      processingStatus: 'failed',
    }).where(and(
      eq(webhookEvents.provider, 'razorpay'),
      eq(webhookEvents.providerEventId, String(eventId)),
    ));
    throw error;
  }
}

export async function createRefund(paymentId, { amountPaise, reason }, actorUserId) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  if (payment.status !== 'captured') {
    throw new ApiError(409, 'Only captured payments can be refunded');
  }

  const refundAmount = amountPaise || payment.amountPaise;
  if (refundAmount > payment.amountPaise) {
    throw new ApiError(400, 'Refund amount exceeds payment amount');
  }

  const [created] = await db.insert(refunds).values({
    paymentId,
    amountPaise: refundAmount,
    status: isRazorpayConfigured() ? 'pending' : 'pending',
    reason: reason ?? null,
  }).returning();

  if (isRazorpayConfigured() && payment.providerPaymentId) {
    const response = await fetch(`${RAZORPAY_REFUNDS_URL}/${payment.providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: razorpayAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: refundAmount,
        notes: {
          reason: reason || 'admin_refund',
        },
      }),
    });

    if (!response.ok) {
      await db.update(refunds).set({ status: 'failed' }).where(eq(refunds.id, created.id));
      throw new ApiError(502, 'Unable to create provider refund');
    }

    const providerRefund = await response.json();
    const [updated] = await db.update(refunds).set({
      providerRefundId: providerRefund.id,
      status: 'processing',
    }).where(eq(refunds.id, created.id)).returning();

    await writeAuditLog({
      actorUserId,
      action: 'payment.refund',
      entityType: 'payment',
      entityId: paymentId,
      metadata: { refundId: updated.id },
    });

    return updated;
  }

  await writeAuditLog({
    actorUserId,
    action: 'payment.refund.recorded',
    entityType: 'payment',
    entityId: paymentId,
    metadata: { refundId: created.id, provider: 'not_configured' },
  });

  await enqueueOrderNotification({
    orderId: payment.orderId,
    eventType: 'refund.recorded',
    payload: {
      refundId: created.id,
      amountPaise: refundAmount,
    },
  });

  return created;
}

export default {
  isRazorpayConfigured,
  initiatePayment,
  processRazorpayWebhook,
  verifyRazorpayWebhookSignature,
  createRefund,
  capturePaymentForOrder,
};
