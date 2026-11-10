import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';

/** Public gallery images. Objects live in the `artwork-images` bucket. */
export const artworkImages = pgTable(
  'artwork_images',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    altText: text('alt_text'),
    displayOrder: integer('display_order').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('artwork_images_artwork_id_idx').on(table.artworkId),
    uniqueIndex('artwork_images_one_primary_per_artwork')
      .on(table.artworkId)
      .where(sql`${table.isPrimary} IS TRUE`),
  ],
);
