import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { shipmentStatusEnum } from './enums.js';
import { orders } from './orders.schema.js';

/** Admin-managed fulfilment. Multiple shipments per order are allowed. */
export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    courierName: varchar('courier_name', { length: 100 }),
    trackingNumber: varchar('tracking_number', { length: 150 }),
    trackingUrl: text('tracking_url'),
    status: shipmentStatusEnum('status').notNull().default('pending'),
    shippedAt: timestamp('shipped_at', { withTimezone: true, mode: 'date' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('shipments_order_id_idx').on(table.orderId),
    index('shipments_tracking_number_idx').on(table.trackingNumber),
    uniqueIndex('shipments_courier_tracking_unique')
      .on(table.courierName, table.trackingNumber)
      .where(sql`${table.courierName} IS NOT NULL AND ${table.trackingNumber} IS NOT NULL`),
  ],
);
