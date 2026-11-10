import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';
import { categories } from './categories.schema.js';

export const artworkCategories = pgTable(
  'artwork_categories',
  {
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({
      name: 'artwork_categories_pk',
      columns: [table.artworkId, table.categoryId],
    }),
  ],
);
