import { integer, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';
import { blogs } from './blogs.schema.js';

export const blogArtworks = pgTable(
  'blog_artworks',
  {
    blogId: uuid('blog_id')
      .notNull()
      .references(() => blogs.id, { onDelete: 'cascade' }),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: 'blog_artworks_pk',
      columns: [table.blogId, table.artworkId],
    }),
  ],
);
