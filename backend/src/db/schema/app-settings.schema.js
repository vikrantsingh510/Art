import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.schema.js';

export const APP_SETTING_WHATSAPP_ENQUIRY = 'whatsapp_enquiry';

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey().notNull(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
