import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { blogStatusEnum } from './enums.js';

export const blogs = pgTable(
  'blogs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    excerpt: text('excerpt'),
    body: text('body').notNull().default(''),
    coverImagePath: text('cover_image_path'),
    coverAltText: text('cover_alt_text'),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: varchar('seo_description', { length: 320 }),
    status: blogStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('blogs_status_idx').on(table.status),
    index('blogs_status_published_at_idx').on(table.status, table.publishedAt),
  ],
);
