import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';
import { wishlists } from './wishlists.schema.js';

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    wishlistId: uuid('wishlist_id')
      .notNull()
      .references(() => wishlists.id, { onDelete: 'cascade' }),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('wishlist_items_wishlist_id_artwork_id_unique').on(
      table.wishlistId,
      table.artworkId,
    ),
    index('wishlist_items_artwork_id_idx').on(table.artworkId),
  ],
);
