export const MAX_NOTIFICATION_ATTEMPTS = 5;
export const NOTIFICATION_BACKOFF_MINUTES = [1, 5, 15, 60, 240];
export const NOTIFICATION_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isDeliverableEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const email = value.trim();
  return email.length > 2 && email.length <= 255 && EMAIL_PATTERN.test(email);
}

export function nextNotificationRetryAt(attempts, now = new Date()) {
  const delayMinutes = NOTIFICATION_BACKOFF_MINUTES[
    Math.min(Math.max(attempts, 1) - 1, NOTIFICATION_BACKOFF_MINUTES.length - 1)
  ];
  return new Date(now.getTime() + delayMinutes * 60 * 1000);
}

export function notificationIdempotencyKey({ eventType, orderId, userId }) {
  return `${eventType}:${orderId || userId || 'system'}`;
}

export default {
  MAX_NOTIFICATION_ATTEMPTS,
  NOTIFICATION_BACKOFF_MINUTES,
  NOTIFICATION_PROCESSING_TIMEOUT_MS,
  isDeliverableEmail,
  nextNotificationRetryAt,
  notificationIdempotencyKey,
};
