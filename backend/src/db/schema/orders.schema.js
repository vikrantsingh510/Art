import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { orderStatusEnum } from './enums.js';
import { profiles } from './profiles.schema.js';

/**
 * Purchase record. Totals are calculated by Express, never trusted from the client.
 * `placed_at` is set when the pending-payment row is inserted (default now()).
 * Do not hard-delete completed orders (ON DELETE RESTRICT from profiles).
 *
 * Checkout (future, one transaction):
 *   1. SELECT … FOR UPDATE on artwork rows
 *   2. Verify available_quantity >= requested
 *   3. Insert order (status = pending_payment, placed_at = now())
 *   4. Insert order_items
 *   5. Insert active inventory_reservations
 *   6. Commit
 *
 * available_quantity = inventory_quantity - SUM(active reservation quantities)
 * is_purchasable = status = published AND available_quantity >= requested_quantity
 * Frontend labels are not the inventory lock.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    status: orderStatusEnum('status').notNull().default('pending_payment'),
    subtotalPaise: bigint('subtotal_paise', { mode: 'number' }).notNull(),
    shippingPaise: bigint('shipping_paise', { mode: 'number' }).notNull().default(0),
    discountPaise: bigint('discount_paise', { mode: 'number' }).notNull().default(0),
    taxPaise: bigint('tax_paise', { mode: 'number' }).notNull().default(0),
    totalPaise: bigint('total_paise', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    shippingAddressSnapshot: jsonb('shipping_address_snapshot').notNull(),
    notes: text('notes'),
    placedAt: timestamp('placed_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('orders_user_id_idx').on(table.userId),
    index('orders_status_idx').on(table.status),
    index('orders_placed_at_idx').on(table.placedAt),
    check('orders_subtotal_paise_non_negative', sql`${table.subtotalPaise} >= 0`),
    check('orders_shipping_paise_non_negative', sql`${table.shippingPaise} >= 0`),
    check('orders_discount_paise_non_negative', sql`${table.discountPaise} >= 0`),
    check('orders_tax_paise_non_negative', sql`${table.taxPaise} >= 0`),
    check('orders_total_paise_non_negative', sql`${table.totalPaise} >= 0`),
    check(
      'orders_total_identity',
      sql`${table.totalPaise} = ${table.subtotalPaise} + ${table.shippingPaise} + ${table.taxPaise} - ${table.discountPaise}`,
    ),
  ],
);
