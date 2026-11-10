import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { EMAIL_TEMPLATES, renderNotification } from '../src/services/email-templates.js';
import { createMemoryOutboxStore } from '../src/services/memory-outbox.store.js';
import { createMockEmailAdapter } from '../src/services/mock-email.adapter.js';
import { ApiError } from '../src/utils/ApiError.js';
import {
  enqueueNotification,
  isDeliverableEmail,
  MAX_NOTIFICATION_ATTEMPTS,
  nextNotificationRetryAt,
  processNotificationOutbox,
  processOutboxBatch,
  resetEmailAdapter,
  resetNotificationStore,
  setEmailAdapter,
  setNotificationStore,
} from '../src/services/notification.service.js';

afterEach(() => {
  resetEmailAdapter();
  resetNotificationStore();
});

test('notification retries back off and eventually fail closed', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(nextNotificationRetryAt(1, now).toISOString(), '2026-01-01T00:01:00.000Z');
  assert.equal(nextNotificationRetryAt(2, now).toISOString(), '2026-01-01T00:05:00.000Z');
  assert.equal(MAX_NOTIFICATION_ATTEMPTS, 5);
});

test('welcome and order templates do not invent payment language', () => {
  const welcome = renderNotification('customer.welcome', { fullName: 'Asha' });
  assert.match(welcome.subject, /Welcome/);
  assert.match(welcome.text, /Asha/);

  const pending = renderNotification('order.pending_payment', { orderNumber: 'MDA-1' });
  assert.match(pending.text, /does not confirm a completed purchase/i);
  assert.doesNotMatch(pending.text, /paid|razorpay|captured/i);

  const shipped = renderNotification('shipment.shipped', {
    orderNumber: 'MDA-1',
    trackingNumber: 'TRK-1',
  });
  assert.match(shipped.text, /marked as shipped/);
  assert.ok(EMAIL_TEMPLATES['order.status_update']);
});

test('mock adapter records delivery without storing the recipient address', async () => {
  const mailer = createMockEmailAdapter();
  const result = await mailer({
    to: 'customer@example.com',
    subject: 'Hello',
    text: 'Body',
    eventType: 'customer.welcome',
  });
  assert.equal(result.provider, 'mock');
  assert.equal(result.recipientDomain, 'example.com');
  assert.equal(mailer.deliveries[0].to, undefined);
});

test('successful mock delivery marks the outbox record sent', async () => {
  const store = createMemoryOutboxStore();
  const mailer = createMockEmailAdapter();
  await enqueueNotification({
    userId: '11111111-1111-4111-8111-111111111111',
    eventType: 'customer.welcome',
    recipientEmail: 'customer@example.com',
    payload: { fullName: 'Asha' },
    store,
  });

  const results = await processOutboxBatch({ store, mailer, now: new Date() });
  assert.deepEqual(results, [{ id: store.list()[0].id, status: 'sent' }]);
  assert.equal(store.list()[0].status, 'sent');
  assert.equal(mailer.deliveries.length, 1);
});

test('failed mock delivery is retried until the maximum attempt count', async () => {
  const store = createMemoryOutboxStore();
  const mailer = createMockEmailAdapter({ failTimes: MAX_NOTIFICATION_ATTEMPTS });
  await enqueueNotification({
    orderId: '33333333-3333-4333-8333-333333333333',
    eventType: 'order.pending_payment',
    recipientEmail: 'customer@example.com',
    payload: { orderNumber: 'MDA-1' },
    store,
  });

  const now = new Date();
  const statuses = [];
  for (let attempt = 0; attempt < MAX_NOTIFICATION_ATTEMPTS; attempt += 1) {
    const tick = new Date(now.getTime() + attempt * 24 * 60 * 60 * 1000);
    const [result] = await processOutboxBatch({ store, mailer, now: tick });
    statuses.push(result.status);
  }

  assert.deepEqual(statuses.slice(0, -1), ['retry', 'retry', 'retry', 'retry']);
  assert.equal(statuses.at(-1), 'failed');
  assert.equal(store.list()[0].status, 'failed');
  assert.equal(store.list()[0].attempts, MAX_NOTIFICATION_ATTEMPTS);

  const extra = await processOutboxBatch({
    store,
    mailer,
    now: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000),
  });
  assert.deepEqual(extra, []);
});

test('duplicate notifications are prevented by idempotency key', async () => {
  const store = createMemoryOutboxStore();
  const input = {
    userId: '11111111-1111-4111-8111-111111111111',
    eventType: 'customer.welcome',
    recipientEmail: 'customer@example.com',
    store,
  };

  const first = await enqueueNotification(input);
  const second = await enqueueNotification(input);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(store.list().length, 1);
});

test('invalid recipients are not enqueued', async () => {
  const store = createMemoryOutboxStore();
  const result = await enqueueNotification({
    eventType: 'customer.welcome',
    recipientEmail: 'not-an-email',
    store,
  });
  assert.deepEqual(result, { skipped: true, reason: 'invalid_recipient' });
  assert.equal(store.list().length, 0);
  assert.equal(isDeliverableEmail(''), false);
  assert.equal(isDeliverableEmail('ok@example.com'), true);
});

test('concurrent processors send a claimed notification once', async () => {
  const store = createMemoryOutboxStore();
  const mailer = createMockEmailAdapter();
  await enqueueNotification({
    orderId: '44444444-4444-4444-8444-444444444444',
    eventType: 'order.confirmed',
    recipientEmail: 'customer@example.com',
    payload: { orderNumber: 'MDA-2' },
    store,
  });

  const now = new Date();
  const [first, second] = await Promise.all([
    processOutboxBatch({ store, mailer, now }),
    processOutboxBatch({ store, mailer, now }),
  ]);

  const sent = [...first, ...second].filter((item) => item.status === 'sent');
  assert.equal(sent.length, 1);
  assert.equal(mailer.deliveries.length, 1);
  assert.equal(store.list()[0].status, 'sent');
});

test('database failures during processing do not crash the process', async () => {
  const store = createMemoryOutboxStore();
  store.failNextClaim();
  setNotificationStore(store);

  await assert.rejects(
    () => processNotificationOutbox(),
    (error) => error instanceof ApiError && error.statusCode === 503,
  );
});

test('outbox status moves pending to processing to sent', async () => {
  const store = createMemoryOutboxStore();
  const mailer = createMockEmailAdapter();
  await enqueueNotification({
    eventType: 'order.status_update',
    recipientEmail: 'customer@example.com',
    payload: { orderNumber: 'MDA-3', status: 'processing' },
    userId: '11111111-1111-4111-8111-111111111111',
    store,
  });
  assert.equal(store.list()[0].status, 'pending');

  const now = new Date();
  await processOutboxBatch({ store, mailer, now });
  assert.equal(store.list()[0].status, 'sent');
  assert.ok(store.list()[0].sentAt);
});
