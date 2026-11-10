import {
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { webhookProcessingStatusEnum } from './enums.js';

/**
 * Gateway callback idempotency. No FK to payments — events can arrive first.
 * Insert-first on UNIQUE(provider, provider_event_id); conflict means skip.
 * Verify signatures in Express before insert. Do not store raw payloads.
 * `payload_hash` is an optional SHA-256 hex of the verified body.
 *
 * Failed processing must remain retryable (status = failed, not deleted).
 * Reprocessing must not decrement inventory twice or double-fulfil an order.
 * Do not expire reservations while payment is authorised or unresolved.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    processingStatus: webhookProcessingStatusEnum('processing_status')
      .notNull()
      .default('received'),
    payloadHash: varchar('payload_hash', { length: 64 }),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('webhook_events_provider_provider_event_id_unique').on(
      table.provider,
      table.providerEventId,
    ),
    index('webhook_events_processing_status_idx').on(table.processingStatus),
  ],
);
