import { logger, toSafeErrorLog } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { createDrizzleOutboxStore } from './drizzle-outbox.store.js';
import { renderNotification } from './email-templates.js';
import { createMockEmailAdapter } from './mock-email.adapter.js';
import {
  isDeliverableEmail,
  MAX_NOTIFICATION_ATTEMPTS,
  nextNotificationRetryAt,
  NOTIFICATION_PROCESSING_TIMEOUT_MS,
  notificationIdempotencyKey,
} from './notification.constants.js';

const defaultMailer = createMockEmailAdapter();
let emailAdapter = defaultMailer;
let outboxStore = createDrizzleOutboxStore();

export {
  isDeliverableEmail,
  MAX_NOTIFICATION_ATTEMPTS,
  nextNotificationRetryAt,
};

export function setEmailAdapter(adapter) {
  emailAdapter = adapter;
}

export function resetEmailAdapter() {
  emailAdapter = defaultMailer;
  defaultMailer.reset?.();
}

export function setNotificationStore(store) {
  outboxStore = store;
}

export function resetNotificationStore() {
  outboxStore = createDrizzleOutboxStore();
}

export const sendMockEmail = defaultMailer;

export async function processOutboxBatch({
  store = outboxStore,
  mailer = emailAdapter,
  limit = 20,
  now = new Date(),
  processingTimeoutMs = NOTIFICATION_PROCESSING_TIMEOUT_MS,
} = {}) {
  const staleBefore = new Date(now.getTime() - processingTimeoutMs);
  const claimed = await store.claimDue({ limit, now, staleBefore });
  const results = [];

  for (const item of claimed) {
    try {
      const rendered = renderNotification(item.eventType, item.payload || {});
      await mailer({
        to: item.recipientEmail,
        subject: rendered.subject,
        text: rendered.text,
        eventType: item.eventType,
      });
      await store.markSent(item.id, now);
      results.push({ id: item.id, status: 'sent' });
    } catch (error) {
      const failed = item.attempts >= MAX_NOTIFICATION_ATTEMPTS;
      try {
        await store.markRetry(item.id, {
          attempts: item.attempts,
          failed,
          lastError: error.message || 'Email send failed',
          scheduledAt: nextNotificationRetryAt(item.attempts, now),
        });
      } catch (persistError) {
        logger.error({
          err: toSafeErrorLog(persistError),
          notificationId: item.id,
        }, 'Failed to persist notification retry state');
      }
      logger.warn({
        notificationId: item.id,
        eventType: item.eventType,
        attempts: item.attempts,
        failed,
      }, 'Mock email delivery failed');
      results.push({ id: item.id, status: failed ? 'failed' : 'retry' });
    }
  }

  return results;
}

export async function enqueueNotification({
  userId,
  orderId,
  eventType,
  recipientEmail,
  payload = {},
  store = outboxStore,
  executor,
} = {}) {
  const email = recipientEmail || payload.email;
  if (!isDeliverableEmail(email)) {
    logger.warn({ userId, orderId, eventType }, 'Notification skipped: invalid recipient');
    return { skipped: true, reason: 'invalid_recipient' };
  }

  const record = {
    userId: userId || null,
    orderId: orderId || null,
    eventType,
    idempotencyKey: notificationIdempotencyKey({ eventType, orderId, userId }),
    recipientEmail: email.trim(),
    payload,
  };

  return store.enqueue(record, executor);
}

export async function enqueueOrderNotification(input, executor) {
  return enqueueNotification({ ...input, executor });
}

export async function processNotificationOutbox(limit = 20, now = new Date()) {
  try {
    return await processOutboxBatch({
      store: outboxStore,
      mailer: emailAdapter,
      limit,
      now,
    });
  } catch (error) {
    logger.error({ err: toSafeErrorLog(error) }, 'Notification outbox processing failed');
    throw new ApiError(503, 'Notification processing unavailable');
  }
}

export default {
  enqueueNotification,
  enqueueOrderNotification,
  processNotificationOutbox,
  processOutboxBatch,
  setEmailAdapter,
  resetEmailAdapter,
  setNotificationStore,
  resetNotificationStore,
  sendMockEmail,
  isDeliverableEmail,
  MAX_NOTIFICATION_ATTEMPTS,
  nextNotificationRetryAt,
};
