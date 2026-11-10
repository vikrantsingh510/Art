import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.schema.js';

/**
 * One wishlist per customer. UNIQUE(user_id) makes signup provisioning
 * idempotent (`ON CONFLICT (user_id) DO NOTHING`).
 */
export const wishlists = pgTable('wishlists', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});
