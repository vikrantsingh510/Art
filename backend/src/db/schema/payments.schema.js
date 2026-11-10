import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { paymentStatusEnum } from './enums.js';
import { orders } from './orders.schema.js';

/**
 * Gateway payment attempts. Multiple rows per order are allowed.
 * Never mark an order paid from a frontend redirect. Verify webhook
 * signatures in Express, then persist via webhook_events idempotency.
 * Razorpay integration is deferred.
 *
 * Duplicate captured attempts for one order must go to reconciliation /
 * refund handling. Reprocessing must not decrement inventory twice.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    providerOrderId: varchar('provider_order_id', { length: 150 }),
    providerPaymentId: varchar('provider_payment_id', { length: 150 }),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    status: paymentStatusEnum('status').notNull().default('created'),
    capturedAt: timestamp('captured_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('payments_order_id_idx').on(table.orderId),
    uniqueIndex('payments_provider_payment_id_unique')
      .on(table.providerPaymentId)
      .where(sql`${table.providerPaymentId} IS NOT NULL`),
    check('payments_amount_paise_positive', sql`${table.amountPaise} > 0`),
  ],
);
