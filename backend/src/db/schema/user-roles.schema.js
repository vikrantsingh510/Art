import { pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums.js';
import { profiles } from './profiles.schema.js';

/**
 * Role assignments. A user may hold both `customer` and `admin` as two rows.
 * Never expose this table as client-writable. Admin assignment is trusted
 * server-side only.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('user_roles_user_id_role_unique').on(table.userId, table.role),
  ],
);
