import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { artworks } from './artworks.schema.js';
import { mediaAccessLevelEnum, mediaTypeEnum } from './enums.js';

/**
 * Videos, certificates and documents.
 * Videos: `artwork-videos` (private). Certificates/documents: `artwork-documents` (private).
 * Store object paths only — never public URLs for private buckets.
 */
export const artworkMedia = pgTable(
  'artwork_media',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    mediaType: mediaTypeEnum('media_type').notNull(),
    storageBucket: varchar('storage_bucket', { length: 100 }).notNull(),
    storagePath: text('storage_path').notNull(),
    originalFilename: text('original_filename'),
    mimeType: varchar('mime_type', { length: 100 }),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    accessLevel: mediaAccessLevelEnum('access_level').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('artwork_media_artwork_id_idx').on(table.artworkId),
    check(
      'artwork_media_file_size_bytes_non_negative',
      sql`${table.fileSizeBytes} IS NULL OR ${table.fileSizeBytes} >= 0`,
    ),
    check(
      'artwork_media_private_certificates_and_documents',
      sql`${table.mediaType} NOT IN ('certificate', 'document') OR ${table.accessLevel} = 'private'`,
    ),
  ],
);
