import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles.schema.js';

export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    recipientName: varchar('recipient_name', { length: 150 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    addressLine1: text('address_line_1').notNull(),
    addressLine2: text('address_line_2'),
    city: varchar('city', { length: 100 }).notNull(),
    state: varchar('state', { length: 100 }).notNull(),
    postalCode: varchar('postal_code', { length: 15 }).notNull(),
    country: varchar('country', { length: 100 }).notNull().default('IN'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('addresses_user_id_idx').on(table.userId),
    uniqueIndex('addresses_one_default_per_user')
      .on(table.userId)
      .where(sql`${table.isDefault} IS TRUE`),
  ],
);
