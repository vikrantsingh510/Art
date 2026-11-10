import { randomUUID } from 'node:crypto';
import { MAX_NOTIFICATION_ATTEMPTS } from './notification.constants.js';

const TERMINAL_FAILED = 'failed';

export function createMemoryOutboxStore() {
  const rows = new Map();
  let lock = Promise.resolve();
  let failNextClaim = false;

  function withLock(callback) {
    const run = lock.then(callback, callback);
    lock = run.catch(() => {});
    return run;
  }

  function clone(row) {
    return { ...row, payload: { ...row.payload } };
  }

  return {
    failNextClaim() {
      failNextClaim = true;
    },

    async enqueue(record) {
      if (rows.has(record.idempotencyKey)) {
        return { duplicate: true, record: clone(rows.get(record.idempotencyKey)) };
      }

      const created = {
        id: record.id || randomUUID(),
        userId: record.userId || null,
        orderId: record.orderId || null,
        eventType: record.eventType,
        idempotencyKey: record.idempotencyKey,
        recipientEmail: record.recipientEmail,
        payload: record.payload || {},
        status: 'pending',
        attempts: 0,
        lastError: null,
        scheduledAt: record.scheduledAt || new Date(),
        sentAt: null,
        createdAt: new Date(),
        locked: false,
      };
      rows.set(created.idempotencyKey, created);
      return { duplicate: false, record: clone(created) };
    },

    async claimDue({ limit, now, staleBefore }) {
      return withLock(async () => {
        if (failNextClaim) {
          failNextClaim = false;
          throw new Error('Simulated database failure');
        }

        const claimed = [];
        for (const row of rows.values()) {
          if (claimed.length >= limit) {
            break;
          }

          if (row.locked) {
            continue;
          }

          const due = row.scheduledAt <= now;
          const retryable = row.attempts < MAX_NOTIFICATION_ATTEMPTS;
          const pendingDue = (row.status === 'pending' || row.status === 'failed') && due && retryable;
          const staleProcessing = row.status === 'processing' && row.scheduledAt <= staleBefore && retryable;

          if (!pendingDue && !staleProcessing) {
            continue;
          }

          row.locked = true;
          row.status = 'processing';
          row.attempts += 1;
          row.scheduledAt = now;
          claimed.push(clone(row));
        }

        return claimed;
      });
    },

    async markSent(id, sentAt = new Date()) {
      return withLock(async () => {
        const row = [...rows.values()].find((item) => item.id === id);
        if (!row) {
          return;
        }

        row.status = 'sent';
        row.sentAt = sentAt;
        row.lastError = null;
        row.locked = false;
      });
    },

    async markRetry(id, { attempts, failed, lastError, scheduledAt }) {
      return withLock(async () => {
        const row = [...rows.values()].find((item) => item.id === id);
        if (!row) {
          return;
        }

        row.status = failed ? TERMINAL_FAILED : 'pending';
        row.attempts = attempts;
        row.lastError = lastError;
        row.scheduledAt = scheduledAt;
        row.locked = false;
      });
    },

    list() {
      return [...rows.values()].map(clone);
    },

    getByKey(idempotencyKey) {
      const row = rows.get(idempotencyKey);
      return row ? clone(row) : null;
    },

    clear() {
      rows.clear();
    },
  };
}

export default createMemoryOutboxStore;
