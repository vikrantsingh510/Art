import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';
import { carts } from './carts.schema.js';

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('cart_items_cart_id_artwork_id_unique').on(table.cartId, table.artworkId),
    index('cart_items_artwork_id_idx').on(table.artworkId),
  ],
);
