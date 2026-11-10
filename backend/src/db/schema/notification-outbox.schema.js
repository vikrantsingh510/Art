import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { notificationStatusEnum } from './enums.js';
import { orders } from './orders.schema.js';
import { profiles } from './profiles.schema.js';

/**
 * Transactional email retry queue. Email provider selection is deferred.
 * `user_id` is nullable for system notifications. UNIQUE(idempotency_key)
 * prevents duplicate sends. Do not store credentials or auth tokens in payload.
 */
export const notificationOutbox = pgTable(
  'notification_outbox',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: notificationStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('notification_outbox_status_scheduled_at_idx').on(
      table.status,
      table.scheduledAt,
    ),
    check('notification_outbox_attempts_non_negative', sql`${table.attempts} >= 0`),
  ],
);
