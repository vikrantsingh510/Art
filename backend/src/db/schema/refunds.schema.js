import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { refundStatusEnum } from './enums.js';
import { payments } from './payments.schema.js';

/**
 * Independent refund records. Do not hard-delete.
 * Net refunded revenue counts only rows with status = 'succeeded'.
 * A succeeded refund does not restock artwork automatically.
 */
export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    providerRefundId: varchar('provider_refund_id', { length: 150 }),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    status: refundStatusEnum('status').notNull().default('pending'),
    reason: text('reason'),
    refundedAt: timestamp('refunded_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('refunds_payment_id_idx').on(table.paymentId),
    uniqueIndex('refunds_provider_refund_id_unique')
      .on(table.providerRefundId)
      .where(sql`${table.providerRefundId} IS NOT NULL`),
    check('refunds_amount_paise_positive', sql`${table.amountPaise} > 0`),
  ],
);
