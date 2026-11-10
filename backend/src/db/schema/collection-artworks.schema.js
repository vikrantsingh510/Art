import { integer, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';
import { collections } from './collections.schema.js';

export const collectionArtworks = pgTable(
  'collection_artworks',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: 'collection_artworks_pk',
      columns: [table.collectionId, table.artworkId],
    }),
  ],
);
