import { index, inet, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.schema.js';

/**
 * Append-only admin/sensitive history. Application DML must INSERT only —
 * never UPDATE or DELETE these rows. Actor removal uses ON DELETE SET NULL.
 * Do not store passwords, tokens, or payment secrets in metadata.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    actorUserId: uuid('actor_user_id').references(() => profiles.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata'),
    ipAddress: inet('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_logs_actor_user_id_idx').on(table.actorUserId),
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ],
);
