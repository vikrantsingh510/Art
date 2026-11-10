import { and, eq, lte, or, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { notificationOutbox } from '../db/schema/index.js';
import {
  MAX_NOTIFICATION_ATTEMPTS,
} from './notification.constants.js';

export function createDrizzleOutboxStore(executor = db) {
  return {
    async enqueue(record, transaction = executor) {
      try {
        const [created] = await transaction.insert(notificationOutbox).values({
          userId: record.userId || null,
          orderId: record.orderId || null,
          eventType: record.eventType,
          idempotencyKey: record.idempotencyKey,
          recipientEmail: record.recipientEmail,
          payload: record.payload || {},
          status: 'pending',
        }).onConflictDoNothing({ target: notificationOutbox.idempotencyKey }).returning();

        return {
          duplicate: !created,
          record: created || null,
        };
      } catch (error) {
        if (String(error?.code) === '23505') {
          return { duplicate: true, record: null };
        }
        throw error;
      }
    },

    async claimDue({ limit, now, staleBefore }) {
      return executor.transaction(async (tx) => {
        const due = await tx
          .select()
          .from(notificationOutbox)
          .where(and(
            sql`${notificationOutbox.attempts} < ${MAX_NOTIFICATION_ATTEMPTS}`,
            or(
              and(
                or(
                  eq(notificationOutbox.status, 'pending'),
                  eq(notificationOutbox.status, 'failed'),
                ),
                lte(notificationOutbox.scheduledAt, now),
              ),
              and(
                eq(notificationOutbox.status, 'processing'),
                lte(notificationOutbox.scheduledAt, staleBefore),
              ),
            ),
          ))
          .orderBy(notificationOutbox.scheduledAt)
          .limit(limit)
          .for('update', { skipLocked: true });

        const claimed = [];
        for (const row of due) {
          const [updated] = await tx.update(notificationOutbox).set({
            status: 'processing',
            attempts: row.attempts + 1,
            scheduledAt: now,
          }).where(eq(notificationOutbox.id, row.id)).returning();
          claimed.push(updated);
        }

        return claimed;
      });
    },

    async markSent(id, sentAt = new Date()) {
      await executor.update(notificationOutbox).set({
        status: 'sent',
        sentAt,
        lastError: null,
      }).where(eq(notificationOutbox.id, id));
    },

    async markRetry(id, { failed, lastError, scheduledAt }) {
      await executor.update(notificationOutbox).set({
        status: failed ? 'failed' : 'pending',
        lastError,
        scheduledAt,
      }).where(eq(notificationOutbox.id, id));
    },
  };
}

export default createDrizzleOutboxStore;
