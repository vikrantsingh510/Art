import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { artistStatusEnum } from './enums.js';

export const artists = pgTable(
  'artists',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    shortBio: text('short_bio'),
    biography: text('biography'),
    profileImagePath: text('profile_image_path'),
    profileImageAlt: text('profile_image_alt'),
    artisticStyle: varchar('artistic_style', { length: 150 }),
    medium: varchar('medium', { length: 150 }),
    location: varchar('location', { length: 150 }),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: varchar('seo_description', { length: 320 }),
    status: artistStatusEnum('status').notNull().default('draft'),
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
    index('artists_status_idx').on(table.status),
    index('artists_status_published_at_idx').on(table.status, table.publishedAt),
    index('artists_name_idx').on(table.name),
  ],
);
