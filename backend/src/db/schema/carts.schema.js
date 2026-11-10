import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.schema.js';

/**
 * One cart per customer. UNIQUE(user_id) makes signup provisioning
 * idempotent (`ON CONFLICT (user_id) DO NOTHING`).
 * Independent from wishlists — checkout reads this table only.
 */
export const carts = pgTable('carts', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
