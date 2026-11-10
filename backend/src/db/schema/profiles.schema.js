import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Application profile. `id` is the same UUID as `auth.users.id`.
 * The FK to `auth.users` is added in migration SQL because that table is owned
 * by Supabase Auth, not this schema.
 *
 * `full_name` is nullable so Google OAuth identities can be provisioned before
 * a display name exists. Email and passwords stay in Auth, not here.
 */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().notNull(),
  fullName: varchar('full_name', { length: 150 }),
  phone: varchar('phone', { length: 20 }),
  avatarPath: text('avatar_path'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('profiles_phone_unique')
    .on(table.phone)
    .where(sql`${table.phone} IS NOT NULL`),
]);
