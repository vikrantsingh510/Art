import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';
import { reservationStatusEnum } from './enums.js';
import { orders } from './orders.schema.js';

/**
 * Stock hold tied to an order (`order_id` is NOT NULL). Created in the same
 * checkout transaction as the pending-payment order.
 *
 * available_quantity = inventory_quantity - SUM(quantity WHERE status = 'active')
 * is_purchasable = artwork.status = 'published' AND available_quantity >= requested
 *
 * Active rows are the lock — not artwork.status. Future checkout uses
 * RESERVATION_TTL_SECONDS (default 900) to set expires_at.
 * Never expire while a payment is authorised or unresolved; reconcile first.
 * Captured payment converts the reservation and decrements inventory_quantity
 * exactly once per successful order. Succeeded refunds do not restock.
 */
export const inventoryReservations = pgTable(
  'inventory_reservations',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    status: reservationStatusEnum('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('inventory_reservations_artwork_id_idx').on(table.artworkId),
    index('inventory_reservations_status_idx').on(table.status),
    index('inventory_reservations_expires_at_idx').on(table.expiresAt),
    check('inventory_reservations_quantity_positive', sql`${table.quantity} > 0`),
  ],
);
