import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';
import { profiles } from './profiles.schema.js';

/**
 * Explicitly saved AR preview metadata. Objects live in the private
 * `artwork-previews` bucket. Store `storage_path` only — never a public URL.
 * Do not persist unsaved camera or room footage. Owner access is enforced in
 * Express (JWT `sub` = user_id); admin access is a trusted server check.
 */
export const artworkPreviews = pgTable(
  'artwork_previews',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    roomMetadata: jsonb('room_metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('artwork_previews_user_id_idx').on(table.userId),
    index('artwork_previews_artwork_id_idx').on(table.artworkId),
  ],
);
