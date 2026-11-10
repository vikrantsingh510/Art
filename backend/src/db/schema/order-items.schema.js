import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';
import { orders } from './orders.schema.js';

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'restrict' }),
    artworkTitle: varchar('artwork_title', { length: 255 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull(),
    totalPricePaise: bigint('total_price_paise', { mode: 'number' }).notNull(),
    artworkSnapshot: jsonb('artwork_snapshot').notNull(),
  },
  (table) => [
    index('order_items_order_id_idx').on(table.orderId),
    check('order_items_quantity_positive', sql`${table.quantity} > 0`),
    check('order_items_unit_price_paise_non_negative', sql`${table.unitPricePaise} >= 0`),
    check('order_items_total_price_paise_non_negative', sql`${table.totalPricePaise} >= 0`),
    check(
      'order_items_line_total_identity',
      sql`${table.totalPricePaise} = ${table.quantity} * ${table.unitPricePaise}`,
    ),
  ],
);
