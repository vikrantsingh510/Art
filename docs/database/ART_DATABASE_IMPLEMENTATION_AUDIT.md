# Art Marketplace — Database Implementation Audit

**Audit type:** Read-only  
**Date:** 5 November 2026  
**Scope:** Drizzle JavaScript schema, five generated SQL migrations, journal, snapshots, backend database configuration  
**Out of scope:** Applying migrations, connecting to Supabase, modifying source, frontend/API implementation  

**Sources compared**

- Approved freeze: architectural decisions in the Phase 1 and Phases 2–5 implementation tasks (CASCADE/RESTRICT/SET NULL map, composite PKs, timestamps, refund statuses, webhook events, Express-only access, availability formula, and related rules).
- Blueprint: `docs/Maison_d_Art_Database_Schema_Blueprint_v1.docx` (v1.0), as refined by those freeze decisions.
- Implementation: `backend/src/db/schema/*.js`, `backend/src/db/migrations/0000`–`0004_*.sql`, `backend/src/db/migrations/meta/_journal.json`, snapshots `0000_snapshot.json`–`0004_snapshot.json`, `backend/drizzle.config.js`, `backend/src/config/database.js`, `backend/src/config/env.js`.

**Verdict key:** PASS | FAIL | PARTIAL | UNVERIFIED | NOT IMPLEMENTED

---

## 1. Executive summary

The repository contains **22 application tables** and **11 PostgreSQL enums** across five sequential Drizzle migrations. Generated SQL matches the JavaScript schema for every table inspected. Phase 1 SQL was not rewritten by later generations.

**Overall implementation verdict: PASS, with documented application-level gaps and one snapshot-tracking risk.**

- No **FAIL** was found where generated SQL contradicts the approved freeze.
- Schema **supports** checkout, payments, webhooks, notifications, and audit, but those **workflows are not implemented**.
- Migrations have **not** been applied to Supabase (no evidence of `drizzle-kit migrate` in this audit; this audit did not apply them).
- The hand-written `profiles.id → auth.users(id)` FK exists in `0000_phase1_identity_gallery.sql` line 142, but is **absent from Drizzle snapshots**. Future `drizzle-kit generate` will not drop it automatically, but recreating migrations from snapshots would omit it.
- Database role privileges (INSERT-only audit logs, RLS, least-privilege `maison_app`) are **UNVERIFIED** from repository files.

---

## 2. Full 22-table inventory

| # | Table | Phase | Migration | Schema file |
|---|---|---|---|---|
| 1 | `profiles` | 1 | `0000_phase1_identity_gallery.sql` | `backend/src/db/schema/profiles.schema.js` |
| 2 | `user_roles` | 1 | `0000_…sql` | `user-roles.schema.js` |
| 3 | `addresses` | 1 | `0000_…sql` | `addresses.schema.js` |
| 4 | `artworks` | 1 | `0000_…sql` | `artworks.schema.js` |
| 5 | `categories` | 1 | `0000_…sql` | `categories.schema.js` |
| 6 | `artwork_categories` | 1 | `0000_…sql` | `artwork-categories.schema.js` |
| 7 | `collections` | 1 | `0000_…sql` | `collections.schema.js` |
| 8 | `collection_artworks` | 1 | `0000_…sql` | `collection-artworks.schema.js` |
| 9 | `artwork_images` | 1 | `0000_…sql` | `artwork-images.schema.js` |
| 10 | `artwork_media` | 1 | `0000_…sql` | `artwork-media.schema.js` |
| 11 | `wishlists` | 2 | `0001_phase2_wishlists_previews.sql` | `wishlists.schema.js` |
| 12 | `wishlist_items` | 2 | `0001_…sql` | `wishlist-items.schema.js` |
| 13 | `artwork_previews` | 2 | `0001_…sql` | `artwork-previews.schema.js` |
| 14 | `orders` | 3 | `0002_phase3_orders_inventory.sql` | `orders.schema.js` |
| 15 | `order_items` | 3 | `0002_…sql` | `order-items.schema.js` |
| 16 | `inventory_reservations` | 3 | `0002_…sql` | `inventory-reservations.schema.js` |
| 17 | `payments` | 4 | `0003_phase4_payments_shipping.sql` | `payments.schema.js` |
| 18 | `refunds` | 4 | `0003_…sql` | `refunds.schema.js` |
| 19 | `shipments` | 4 | `0003_…sql` | `shipments.schema.js` |
| 20 | `webhook_events` | 4 | `0003_…sql` | `webhook-events.schema.js` |
| 21 | `notification_outbox` | 5 | `0004_phase5_notifications_audit.sql` | `notification-outbox.schema.js` |
| 22 | `audit_logs` | 5 | `0004_…sql` | `audit-logs.schema.js` |

Snapshot `0004_snapshot.json` lists the same 22 `public.*` tables (lines 8–2358). Barrel `backend/src/db/schema/index.js` exports all 22. **PASS**

---

## 3. Column-by-column audit

Nullability and defaults below are taken from generated SQL (source of truth for PostgreSQL). JS property names are camelCase in Drizzle; SQL names are snake_case.

### 3.1 `profiles` — Phase 1 — `0000` lines 110–118

| Column | SQL type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | none | PK. Same UUID as Auth user. |
| `full_name` | `varchar(150)` | NULL | — | Approved nullable. |
| `phone` | `varchar(20)` | NULL | — | |
| `avatar_path` | `text` | NULL | — | Storage path, not a URL. |
| `is_active` | `boolean` | NOT NULL | `true` | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | ORM `$onUpdate` only; no SQL trigger. |

- PK: `id`
- FK: `profiles_id_auth_users_id_fk` → `auth.users(id)` **ON DELETE CASCADE** — SQL `0000` line 142. **Not** declared in `profiles.schema.js`. Snapshot `0004` `public.profiles.foreignKeys` is `{}` (line 1852).
- Unique / indexes / CHECKs: none besides PK
- Enums: none
- No `email`, `password`, or `password_hash` columns. **PASS** vs identity rules.

### 3.2 `user_roles` — Phase 1 — `0000` lines 120–126, 135

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `user_id` | `uuid` | NOT NULL | — |
| `role` | `user_role` | NOT NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- UNIQUE `(user_id, role)` — `user_roles_user_id_role_unique` (`0000` line 125; `user-roles.schema.js` lines 22–24)
- FK `user_roles_user_id_profiles_id_fk` → `profiles(id)` **ON DELETE CASCADE** (`0000` line 135)
- Dual roles allowed (no UNIQUE on `user_id` alone). **PASS**
- Client-write protection is comment-only (`user-roles.schema.js` lines 5–8). No GRANT/RLS in repo. **NOT IMPLEMENTED** as a database privilege.

### 3.3 `addresses` — Phase 1 — `0000` lines 5–19, 128, 136–137

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `user_id` | `uuid` | NOT NULL | — |
| `recipient_name` | `varchar(150)` | NOT NULL | — |
| `phone` | `varchar(20)` | NOT NULL | — |
| `address_line_1` | `text` | NOT NULL | — |
| `address_line_2` | `text` | NULL | — |
| `city` | `varchar(100)` | NOT NULL | — |
| `state` | `varchar(100)` | NOT NULL | — |
| `postal_code` | `varchar(15)` | NOT NULL | — |
| `country` | `varchar(100)` | NOT NULL | `'IN'` |
| `is_default` | `boolean` | NOT NULL | `false` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

- FK → `profiles(id)` **ON DELETE CASCADE** (`0000` line 128)
- INDEX `addresses_user_id_idx` (`0000` line 136)
- UNIQUE INDEX `addresses_one_default_per_user` ON `(user_id) WHERE is_default IS TRUE` (`0000` line 137). **PASS**
- Switching the default address still requires an application transaction to unset the previous row.

### 3.4 `artworks` — Phase 1 — `0000` lines 53–78, 141

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `title` | `varchar(255)` | NOT NULL | — |
| `slug` | `varchar(255)` | NOT NULL | UNIQUE `artworks_slug_unique` |
| `description` | `text` | NULL | — |
| `story` | `text` | NULL | — |
| `technique` | `varchar(150)` | NULL | — |
| `medium` | `varchar(150)` | NULL | — |
| `material` | `varchar(150)` | NULL | — |
| `artist_name` | `varchar(150)` | NOT NULL | — No artists table. **PASS** |
| `year_created` | `integer` | NULL | — |
| `width` | `numeric(10,2)` | NULL | — Dimension, not money |
| `height` | `numeric(10,2)` | NULL | — |
| `depth` | `numeric(10,2)` | NULL | — |
| `dimension_unit` | `varchar(10)` | NULL | — |
| `price_paise` | `bigint` | NOT NULL | CHECK `>= 0` |
| `currency` | `varchar(3)` | NOT NULL | `'INR'` |
| `inventory_quantity` | `integer` | NOT NULL | `1`; CHECK `>= 0` |
| `status` | `artwork_status` | NOT NULL | `'draft'` |
| `is_featured` | `boolean` | NOT NULL | `false` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

- INDEX `artworks_status_idx` (`0000` line 141)
- No `category_id`. Categories are M:N via `artwork_categories`. **PASS**
- No generic `deleted_at`. **PASS**
- `status` is not a stock lock (comment in `artworks.schema.js` lines 17–21). **PASS** as documentation; enforcement is application-level.

### 3.5 `categories` — Phase 1 — `0000` lines 80–89

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `name` | `varchar(150)` | NOT NULL | — |
| `slug` | `varchar(255)` | NOT NULL | UNIQUE `categories_slug_unique` |
| `description` | `text` | NULL | — |
| `is_active` | `boolean` | NOT NULL | `true` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

**PASS** unique slug and timestamps.

### 3.6 `artwork_categories` — Phase 1 — `0000` lines 21–25, 129–130

| Column | SQL type | Null | Default |
|---|---|---|---|
| `artwork_id` | `uuid` | NOT NULL | — |
| `category_id` | `uuid` | NOT NULL | — |

- Composite PK `artwork_categories_pk (artwork_id, category_id)` (`0000` line 24). **PASS**
- FK artwork **ON DELETE CASCADE** (line 129)
- FK category **ON DELETE RESTRICT** (line 130). **PASS** vs freeze (join uniqueness implied by PK)

### 3.7 `collections` — Phase 1 — `0000` lines 98–108

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `name` | `varchar(150)` | NOT NULL | — |
| `slug` | `varchar(255)` | NOT NULL | UNIQUE `collections_slug_unique` |
| `description` | `text` | NULL | — |
| `cover_image_path` | `text` | NULL | — |
| `is_published` | `boolean` | NOT NULL | `false` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

**PASS**

### 3.8 `collection_artworks` — Phase 1 — `0000` lines 91–96, 133–134

| Column | SQL type | Null | Default |
|---|---|---|---|
| `collection_id` | `uuid` | NOT NULL | — |
| `artwork_id` | `uuid` | NOT NULL | — |
| `display_order` | `integer` | NOT NULL | `0` |

- Composite PK `collection_artworks_pk` (`0000` line 95). **PASS**
- Both FKs **ON DELETE CASCADE** (lines 133–134). **PASS**

### 3.9 `artwork_images` — Phase 1 — `0000` lines 27–35, 131, 138–139

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `artwork_id` | `uuid` | NOT NULL | — |
| `storage_path` | `text` | NOT NULL | — Path, not signed URL |
| `alt_text` | `text` | NULL | — |
| `display_order` | `integer` | NOT NULL | `0` |
| `is_primary` | `boolean` | NOT NULL | `false` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK **ON DELETE CASCADE** (line 131)
- INDEX `artwork_images_artwork_id_idx` (line 138)
- UNIQUE INDEX `artwork_images_one_primary_per_artwork` ON `(artwork_id) WHERE is_primary IS TRUE` (line 139). **PASS**
- Bucket `artwork-images` is documented in schema comments only, not a CHECK.

### 3.10 `artwork_media` — Phase 1 — `0000` lines 37–51, 132, 140

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `artwork_id` | `uuid` | NOT NULL | — |
| `media_type` | `media_type` | NOT NULL | — |
| `storage_bucket` | `varchar(100)` | NOT NULL | — No CHECK of allowed bucket names |
| `storage_path` | `text` | NOT NULL | — |
| `original_filename` | `text` | NULL | — |
| `mime_type` | `varchar(100)` | NULL | — |
| `file_size_bytes` | `bigint` | NULL | CHECK null or `>= 0` |
| `access_level` | `media_access_level` | NOT NULL | — |
| `display_order` | `integer` | NOT NULL | `0` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK **ON DELETE CASCADE** (line 132)
- INDEX `artwork_media_artwork_id_idx` (line 140)
- CHECK `artwork_media_private_certificates_and_documents`: certificates/documents must be `private` (`0000` line 50). **PASS**
- Videos may still be stored with `access_level = public` in the table. Bucket privacy is not a DB constraint. **PARTIAL** (row-level private flag for certificates/documents; bucket names not constrained)

### 3.11 `wishlists` — Phase 2 — `0001` lines 18–23, 29

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `user_id` | `uuid` | NOT NULL | UNIQUE `wishlists_user_id_unique` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK → `profiles(id)` **ON DELETE CASCADE** (`0001` line 29). **PASS** one wishlist per user.

### 3.12 `wishlist_items` — Phase 2 — `0001` lines 10–16, 27–28, 32

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `wishlist_id` | `uuid` | NOT NULL | — |
| `artwork_id` | `uuid` | NOT NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- UNIQUE `(wishlist_id, artwork_id)` (`0001` line 15). **PASS**
- FK wishlist **ON DELETE CASCADE** (line 27)
- FK artwork **ON DELETE CASCADE** (line 28) — freeze decision 16. **PASS**
- INDEX `wishlist_items_artwork_id_idx` (line 32)

### 3.13 `artwork_previews` — Phase 2 — `0001` lines 1–8, 25–26, 30–31

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `user_id` | `uuid` | NOT NULL | — |
| `artwork_id` | `uuid` | NOT NULL | — |
| `storage_path` | `text` | NOT NULL | — Path only |
| `room_metadata` | `jsonb` | NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK user **ON DELETE CASCADE** (line 25)
- FK artwork **ON DELETE CASCADE** (line 26). **PASS**
- Indexes on `user_id` and `artwork_id` (lines 30–31)
- Bucket `artwork-previews` is a comment (`artwork-previews.schema.js` lines 5–9), not a CHECK. Owner authorization is Express, not RLS. **NOT IMPLEMENTED** as runtime auth.

### 3.14 `orders` — Phase 3 — `0002` lines 29–52, 58, 63–64

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `order_number` | `varchar(50)` | NOT NULL | UNIQUE |
| `user_id` | `uuid` | NOT NULL | — |
| `status` | `order_status` | NOT NULL | `'pending_payment'` |
| `subtotal_paise` | `bigint` | NOT NULL | CHECK `>= 0` |
| `shipping_paise` | `bigint` | NOT NULL | `0`; CHECK `>= 0` |
| `discount_paise` | `bigint` | NOT NULL | `0`; CHECK `>= 0` |
| `tax_paise` | `bigint` | NOT NULL | `0`; CHECK `>= 0` |
| `total_paise` | `bigint` | NOT NULL | CHECK `>= 0` |
| `currency` | `varchar(3)` | NOT NULL | `'INR'` |
| `shipping_address_snapshot` | `jsonb` | NOT NULL | — Approved snapshot column |
| `notes` | `text` | NULL | — |
| `placed_at` | `timestamptz` | NOT NULL | `now()` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

- CHECK `orders_total_identity`: `total = subtotal + shipping + tax - discount` (`0002` line 51). **PASS**
- FK → `profiles(id)` **ON DELETE RESTRICT** (`0002` line 58). **PASS** (order history protected)
- INDEX `orders_user_id_idx`, `orders_status_idx` (lines 63–64)
- No `billing_address_snapshot` (not in freeze). **PASS**
- No `deleted_at`. **PASS**
- “Do not hard-delete” is RESTRICT + no API, not a DB revoke of DELETE. **PARTIAL** vs privilege intent

### 3.15 `order_items` — Phase 3 — `0002` lines 14–27, 56–57, 62

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `order_id` | `uuid` | NOT NULL | — |
| `artwork_id` | `uuid` | NOT NULL | — |
| `artwork_title` | `varchar(255)` | NOT NULL | Snapshot |
| `quantity` | `integer` | NOT NULL | CHECK `> 0` |
| `unit_price_paise` | `bigint` | NOT NULL | CHECK `>= 0` |
| `total_price_paise` | `bigint` | NOT NULL | CHECK `>= 0` |
| `artwork_snapshot` | `jsonb` | NOT NULL | — |

- CHECK line total `quantity * unit_price_paise = total_price_paise` (`0002` line 26). **PASS**
- FK order **ON DELETE RESTRICT** (line 56)
- FK artwork **ON DELETE RESTRICT** (line 57) — completed orders remain if artwork is archived, not deleted. **PASS**
- INDEX `order_items_order_id_idx` (line 62)
- No CHECK that `SUM(order_items.total_price_paise) = orders.subtotal_paise`. See §8.

### 3.16 `inventory_reservations` — Phase 3 — `0002` lines 3–12, 54–55, 59–61

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `artwork_id` | `uuid` | NOT NULL | — |
| `order_id` | `uuid` | **NOT NULL** | — Required order association. **PASS** |
| `quantity` | `integer` | NOT NULL | CHECK `> 0` |
| `status` | `reservation_status` | NOT NULL | `'active'` |
| `expires_at` | `timestamptz` | NOT NULL | none (app sets TTL) |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK artwork **ON DELETE RESTRICT** (line 54)
- FK order **ON DELETE RESTRICT** (line 55)
- INDEX artwork_id, status, expires_at (lines 59–61). **PASS**
- No CHECK that Σ(active quantity) ≤ `artworks.inventory_quantity`. **Application-level.**

### 3.17 `payments` — Phase 4 — `0003` lines 5–17, 55, 58–59

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `order_id` | `uuid` | NOT NULL | No UNIQUE(order_id). **PASS** multi-attempt |
| `provider` | `varchar(50)` | NOT NULL | — |
| `provider_order_id` | `varchar(150)` | NULL | — |
| `provider_payment_id` | `varchar(150)` | NULL | Partial unique |
| `amount_paise` | `bigint` | NOT NULL | CHECK `> 0` |
| `currency` | `varchar(3)` | NOT NULL | `'INR'` |
| `status` | `payment_status` | NOT NULL | `'created'` |
| `captured_at` | `timestamptz` | NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK → `orders(id)` **ON DELETE RESTRICT** (`0003` line 55)
- UNIQUE INDEX `payments_provider_payment_id_unique` WHERE `provider_payment_id IS NOT NULL` (line 59). **PASS**
- No UNIQUE on captured-per-order. Duplicate captures are possible. See §10.

### 3.18 `refunds` — Phase 4 — `0003` lines 19–29, 56, 60–61

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `payment_id` | `uuid` | NOT NULL | FK payments only (no order_id column) |
| `provider_refund_id` | `varchar(150)` | NULL | Partial unique |
| `amount_paise` | `bigint` | NOT NULL | CHECK `> 0` |
| `status` | `refund_status` | NOT NULL | `'pending'` |
| `reason` | `text` | NULL | — |
| `refunded_at` | `timestamptz` | NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK → `payments(id)` **ON DELETE RESTRICT** (`0003` line 56). **PASS** vs approved schema (payment_id, not order_id)
- UNIQUE INDEX `refunds_provider_refund_id_unique` WHERE NOT NULL (line 61). **PASS**
- No CHECK `amount_paise ≤ parent payment`. See §8.
- No CHECK that `refunded_at` is set iff `status = succeeded`. Application-level.

### 3.19 `shipments` — Phase 4 — `0003` lines 31–41, 57, 62–64

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `order_id` | `uuid` | NOT NULL | No UNIQUE(order_id). **PASS** multi-shipment |
| `courier_name` | `varchar(100)` | NULL | — |
| `tracking_number` | `varchar(150)` | NULL | — |
| `tracking_url` | `text` | NULL | — |
| `status` | `shipment_status` | NOT NULL | `'pending'` |
| `shipped_at` | `timestamptz` | NULL | — |
| `delivered_at` | `timestamptz` | NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK → `orders(id)` **ON DELETE RESTRICT** (line 57)
- INDEX order_id, tracking_number (lines 62–63)
- UNIQUE INDEX `shipments_courier_tracking_unique` ON `(courier_name, tracking_number) WHERE both IS NOT NULL` (line 64). **PASS**

### 3.20 `webhook_events` — Phase 4 — `0003` lines 43–53, 65

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `provider` | `varchar(50)` | NOT NULL | — |
| `provider_event_id` | `varchar(255)` | NOT NULL | — |
| `event_type` | `varchar(100)` | NOT NULL | — |
| `processing_status` | `webhook_processing_status` | NOT NULL | `'received'` |
| `payload_hash` | `varchar(64)` | NULL | Optional SHA-256 hex; not raw payload. **PASS** vs decision 8 |
| `processed_at` | `timestamptz` | NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- UNIQUE `(provider, provider_event_id)` (`0003` line 52). **PASS**
- INDEX `webhook_events_processing_status_idx` (line 65). **PASS**
- **No FK** to `payments` or `orders`. **PASS**
- No raw payload column. **PASS**
- No `last_error` (not in approved column list). Retry is status-based.

### 3.21 `notification_outbox` — Phase 5 — `0004` lines 13–29, 32–33, 37

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `user_id` | `uuid` | **NULL** | System notifications. **PASS** |
| `order_id` | `uuid` | NULL | — |
| `event_type` | `varchar(100)` | NOT NULL | — |
| `idempotency_key` | `varchar(255)` | NOT NULL | UNIQUE |
| `recipient_email` | `varchar(255)` | NOT NULL | Copied at enqueue |
| `payload` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| `status` | `notification_status` | NOT NULL | `'pending'` |
| `attempts` | `integer` | NOT NULL | `0`; CHECK `>= 0` |
| `last_error` | `text` | NULL | **PASS** vs freeze |
| `scheduled_at` | `timestamptz` | NOT NULL | `now()` |
| `sent_at` | `timestamptz` | NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK user **ON DELETE SET NULL** (`0004` line 32). **PASS**
- FK order **ON DELETE RESTRICT** (line 33)
- UNIQUE `notification_outbox_idempotency_key_unique` (line 27). **PASS**
- INDEX `(status, scheduled_at)` (line 37). **PASS** worker query

### 3.22 `audit_logs` — Phase 5 — `0004` lines 2–11, 31, 34–36

| Column | SQL type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` PK |
| `actor_user_id` | `uuid` | NULL | System actors |
| `action` | `varchar(100)` | NOT NULL | — |
| `entity_type` | `varchar(100)` | NOT NULL | — |
| `entity_id` | `uuid` | NULL | — |
| `metadata` | `jsonb` | NULL | — |
| `ip_address` | `inet` | NULL | SQL: `"ip_address" "inet"` (`0004` line 9) |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

- FK actor **ON DELETE SET NULL** (`0004` line 31). **PASS**
- INDEX actor, `(entity_type, entity_id)`, `created_at` (lines 34–36). **PASS**
- No UPDATE/DELETE trigger or REVOKE in migrations. Append-only is a comment (`audit-logs.schema.js` lines 4–7). Privilege enforcement **UNVERIFIED**.

---

## 4. Enum catalogue (11 types)

Defined once in `backend/src/db/schema/enums.js`. Each `CREATE TYPE` appears in exactly one migration. Snapshot `0004_snapshot.json` lines 2413–2526 lists the same 11.

| Enum | Values | JS | SQL | Used by |
|---|---|---|---|---|
| `user_role` | customer, admin | `enums.js` 3 | `0000` L1 | `user_roles.role` |
| `artwork_status` | draft, published, reserved, sold, archived | 5–11 | `0000` L1 | `artworks.status` |
| `media_type` | video, certificate, document | 13–17 | `0000` L3 | `artwork_media.media_type` |
| `media_access_level` | public, private | 19–22 | `0000` L2 | `artwork_media.access_level` |
| `order_status` | pending_payment, confirmed, processing, shipped, delivered, cancelled, refund_pending, refunded | 24–33 | `0002` L1 | `orders.status` |
| `reservation_status` | active, converted, released, expired | 35–40 | `0002` L2 | `inventory_reservations.status` |
| `payment_status` | created, authorized, captured, failed | 42–47 | `0003` L1 | `payments.status` |
| `refund_status` | pending, processing, succeeded, failed, cancelled | 49–55 | `0003` L2 | `refunds.status` |
| `shipment_status` | pending, packed, shipped, delivered, returned | 57–63 | `0003` L3 | `shipments.status` |
| `webhook_processing_status` | received, processing, processed, failed | 65–70 | `0003` L4 | `webhook_events.processing_status` |
| `notification_status` | pending, processing, sent, failed | 72–77 | `0004` L1 | `notification_outbox.status` |

No duplicate `pgEnum` names elsewhere (`pgEnum(` appears only in `enums.js`). JS values match SQL `CREATE TYPE` lists. **PASS**

State *transitions* are not CHECK-constrained. **Application-level.**

---

## 5. Primary key and foreign key matrix

| Child | Key | Parent | Actual SQL ON DELETE | File |
|---|---|---|---|---|
| `profiles.id` | PK + FK | `auth.users.id` | **CASCADE** | `0000` L142 |
| `user_roles.user_id` | FK | `profiles.id` | **CASCADE** | `0000` L135 |
| `addresses.user_id` | FK | `profiles.id` | **CASCADE** | `0000` L128 |
| `wishlists.user_id` | FK | `profiles.id` | **CASCADE** | `0001` L29 |
| `wishlist_items.wishlist_id` | FK | `wishlists.id` | **CASCADE** | `0001` L27 |
| `wishlist_items.artwork_id` | FK | `artworks.id` | **CASCADE** | `0001` L28 |
| `artwork_previews.user_id` | FK | `profiles.id` | **CASCADE** | `0001` L25 |
| `artwork_previews.artwork_id` | FK | `artworks.id` | **CASCADE** | `0001` L26 |
| `artwork_images.artwork_id` | FK | `artworks.id` | **CASCADE** | `0000` L131 |
| `artwork_media.artwork_id` | FK | `artworks.id` | **CASCADE** | `0000` L132 |
| `artwork_categories.artwork_id` | PK part | `artworks.id` | **CASCADE** | `0000` L129 |
| `artwork_categories.category_id` | PK part | `categories.id` | **RESTRICT** | `0000` L130 |
| `collection_artworks.collection_id` | PK part | `collections.id` | **CASCADE** | `0000` L133 |
| `collection_artworks.artwork_id` | PK part | `artworks.id` | **CASCADE** | `0000` L134 |
| `orders.user_id` | FK | `profiles.id` | **RESTRICT** | `0002` L58 |
| `order_items.order_id` | FK | `orders.id` | **RESTRICT** | `0002` L56 |
| `order_items.artwork_id` | FK | `artworks.id` | **RESTRICT** | `0002` L57 |
| `inventory_reservations.artwork_id` | FK | `artworks.id` | **RESTRICT** | `0002` L54 |
| `inventory_reservations.order_id` | FK | `orders.id` | **RESTRICT** | `0002` L55 |
| `payments.order_id` | FK | `orders.id` | **RESTRICT** | `0003` L55 |
| `refunds.payment_id` | FK | `payments.id` | **RESTRICT** | `0003` L56 |
| `shipments.order_id` | FK | `orders.id` | **RESTRICT** | `0003` L57 |
| `webhook_events` | — | none | — | `0003` L43–53 |
| `notification_outbox.user_id` | FK | `profiles.id` | **SET NULL** | `0004` L32 |
| `notification_outbox.order_id` | FK | `orders.id` | **RESTRICT** | `0004` L33 |
| `audit_logs.actor_user_id` | FK | `profiles.id` | **SET NULL** | `0004` L31 |

Matches freeze: CASCADE profile-owned (plus artwork→wishlist/previews); RESTRICT financial/order history; SET NULL audit actor (and nullable outbox user). **PASS**

Composite PKs: `artwork_categories_pk`, `collection_artworks_pk`. **PASS**

---

## 6. ON DELETE matrix vs freeze

| Rule | Evidence | Verdict |
|---|---|---|
| CASCADE profile-owned data | roles, addresses, wishlists, previews | **PASS** |
| CASCADE artwork → wishlist items and previews | `0001` L26, L28 | **PASS** |
| RESTRICT order/payment/refund/shipment/reservation history | `0002` L54–58, `0003` L55–57 | **PASS** |
| SET NULL audit actor | `0004` L31 | **PASS** |
| `inventory_reservations.order_id` NOT NULL | `0002` L6 | **PASS** |
| Multiple payments/shipments | no `UNIQUE(order_id)` in `0003` | **PASS** |

---

## 7. Index and constraint matrix

| Constraint / index | Table | SQL evidence | Verdict |
|---|---|---|---|
| UNIQUE `(user_id, role)` | `user_roles` | `0000` L125 | **PASS** |
| UNIQUE slug | `artworks`, `categories`, `collections` | `0000` L75, L88, L107 | **PASS** |
| Partial unique default address | `addresses` | `0000` L137 `WHERE is_default IS TRUE` | **PASS** |
| Partial unique primary image | `artwork_images` | `0000` L139 | **PASS** |
| Composite PK categories join | `artwork_categories` | `0000` L24 | **PASS** |
| Composite PK collection join | `collection_artworks` | `0000` L95 | **PASS** |
| UNIQUE `user_id` | `wishlists` | `0001` L22 | **PASS** |
| UNIQUE `(wishlist_id, artwork_id)` | `wishlist_items` | `0001` L15 | **PASS** |
| UNIQUE `order_number` | `orders` | `0002` L45 | **PASS** |
| Partial unique `provider_payment_id` | `payments` | `0003` L59 | **PASS** |
| Partial unique `provider_refund_id` | `refunds` | `0003` L61 | **PASS** |
| Partial unique courier+tracking | `shipments` | `0003` L64 | **PASS** |
| UNIQUE `(provider, provider_event_id)` | `webhook_events` | `0003` L52 | **PASS** |
| UNIQUE `idempotency_key` | `notification_outbox` | `0004` L27 | **PASS** |
| Worker index `(status, scheduled_at)` | `notification_outbox` | `0004` L37 | **PASS** |
| `processing_status` index | `webhook_events` | `0003` L65 | **PASS** |
| Reservation indexes | `inventory_reservations` | `0002` L59–61 | **PASS** |
| Order indexes `user_id`, `status` | `orders` | `0002` L63–64 | **PASS** |

---

## 8. Financial integrity audit

**Money storage**

All monetary columns are PostgreSQL `bigint` (integer paise). No `float`/`real`/`double precision` money columns exist. `numeric(10,2)` is used only for artwork dimensions (`0000` L64–66). **PASS**

| Column | Table | Type | CHECK | Default currency |
|---|---|---|---|---|
| `price_paise` | `artworks` | bigint | `>= 0` | `INR` |
| `subtotal_paise` … `total_paise` | `orders` | bigint | each `>= 0`; total identity | `INR` |
| `unit_price_paise`, `total_price_paise` | `order_items` | bigint | `>= 0`; line identity | inherited |
| `amount_paise` | `payments` | bigint | `> 0` | `INR` |
| `amount_paise` | `refunds` | bigint | `> 0` | n/a |

JS mapping uses Drizzle `{ mode: 'number' }` (`artworks.schema.js` L41, `orders.schema.js` L42–46, etc.). PostgreSQL type remains `bigint`. Safe for marketplace-scale INR paise; not a schema FAIL.

**Present CHECKs (PASS)**

- `orders_total_identity` (`0002` L51)
- `order_items_line_total_identity` (`0002` L26)
- Positive quantities on `order_items` and `inventory_reservations`
- Payment/refund amounts `> 0`

**Missing constraints that can still admit invalid financial rows** (not freeze FAILs; identified as residual risk)

| Gap | Risk | Verdict |
|---|---|---|
| No CHECK `SUM(order_items.total_price_paise) = orders.subtotal_paise` | Header/line mismatch | Missing; application must validate |
| No CHECK refund amount ≤ parent captured payment | Over-refund | Missing; needs trigger or app |
| No CHECK `currency IN ('INR')` | Non-INR rows despite default | Default only |
| No CHECK `captured_at` set iff `status = captured` | Inconsistent capture metadata | Application |
| No CHECK `refunded_at` set iff `status = succeeded` | Inconsistent refund metadata | Application |
| No unique partial index one `captured` payment per order | Two captured rows for one order | Application / reconciliation — see §10 |
| Succeeded refunds do not restock | Correct per freeze | Documented; **NOT IMPLEMENTED** as a restock workflow (intentional) |

Net revenue rule “only `succeeded` refunds count” is **not** a SQL view or CHECK. It is a reporting rule for future Express/analytics. **NOT IMPLEMENTED** as a database object.

---

## 9. Inventory and reservation audit

**Schema support (PASS)**

- `inventory_quantity` on `artworks` with CHECK `>= 0` (`0000` L70, L77)
- Active hold via `inventory_reservations.status` default `'active'` (`0002` L8)
- Expiry column `expires_at` NOT NULL (`0002` L9)
- Conversion/release/expiry statuses in `reservation_status` (`0002` L2)
- `order_id` NOT NULL (`0002` L6)
- Indexes on artwork, status, expiry (`0002` L59–61)
- Purchase snapshots on `order_items` (`0002` L18–22)

**Availability formula** is documented in `backend/src/db/schema/index.js` lines 13–15 and `inventory-reservations.schema.js` lines 18–19:

```
available_quantity = inventory_quantity - SUM(active reservation quantities)
is_purchasable = artwork.status = published AND available_quantity >= requested
```

The schema **can store** the inputs. It does **not** compute or enforce them.

**Database-enforced**

- Reservation row cannot exist without an order
- Quantity `> 0`
- Artwork/order cannot be deleted while reservations exist (RESTRICT)
- Enum values only

**Application-level (NOT IMPLEMENTED)**

- `SELECT … FOR UPDATE` checkout transaction
- Rejecting checkout when `available_quantity < requested`
- Setting `expires_at = now() + RESERVATION_TTL_SECONDS`
- `RESERVATION_TTL_SECONDS` env (absent from `backend/src/config/env.js` and `.env.example`; mentioned only in comments)
- Expiry worker that skips authorised/unresolved payments
- Converting reservation and decrementing `inventory_quantity` **exactly once** on capture
- Preventing two concurrent checkouts from inserting active reservations that sum above stock (no exclusion constraint / trigger)

**Do not treat table existence as concurrency protection.** Oversell is possible until Express implements the transactional checkout described in comments.

---

## 10. Payment and webhook audit

**Schema (PASS)**

- Multiple payment attempts: no `UNIQUE(order_id)` on `payments` (`0003` L5–17)
- Statuses: `created | authorized | captured | failed` (`0003` L1)
- Refund statuses including `succeeded` (`0003` L2)
- Webhook statuses `received | processing | processed | failed` (`0003` L4)
- Event uniqueness `UNIQUE(provider, provider_event_id)` (`0003` L52)
- Retry: failed rows remain (`processing_status` can return to `processing`); index on status (`0003` L65)
- No raw payload column; optional `payload_hash varchar(64)` (`0003` L49)
- No FK from `webhook_events` to `payments`

**Missing database support for duplicate-capture / recovery** (application, not schema FAIL)

| Concern | Schema | Implication |
|---|---|---|
| Two `captured` payments for one order | Allowed | Must detect in Express and send to refund/recon |
| Exactly-once inventory decrement | No unique “converted reservation per order” beyond app writes | Reprocessing can double-decrement if app is naive |
| Webhook signature verification | Not in DB | Express must verify before insert |
| Event recovery after `failed` | Row kept; no `last_error` on webhook_events | Outbox has `last_error`; webhooks do not |
| Razorpay APIs / webhook HTTP | None in `backend/src` | **NOT IMPLEMENTED** |

Frontend redirect as proof of payment is not a schema issue; it is a future API rule documented in `payments.schema.js` lines 16–18.

---

## 11. Notification and audit-log audit

**notification_outbox — PASS (schema)**

- Unique `idempotency_key` (`0004` L27)
- Retry: `status`, `attempts`, `scheduled_at`, `last_error` (`0004` L21–24)
- Nullable `user_id` (`0004` L15) with **ON DELETE SET NULL** (`0004` L32)
- Worker index `(status, scheduled_at)` (`0004` L37)
- Payload default `{}`; no credential columns

Email provider and worker: **NOT IMPLEMENTED**

**audit_logs — PARTIAL / UNVERIFIED for append-only**

- Actor FK SET NULL: **PASS** (`0004` L31)
- Indexes: actor, entity pair, created_at: **PASS**
- Comment forbids UPDATE/DELETE (`audit-logs.schema.js` L4–6)
- Migrations contain **no** `REVOKE UPDATE, DELETE`, no trigger, no `ENABLE ROW LEVEL SECURITY`
- Snapshot `0004` `"roles": {}`, `"policies": {}`, tables `"isRLSEnabled": false` (e.g. profiles at L1857)

**Append-only security is UNVERIFIED** from repository evidence. The connecting role in `database.js` uses `DATABASE_URL` (typically Supabase `postgres`, which bypasses RLS).

---

## 12. Migration-by-migration review

Journal `backend/src/db/migrations/meta/_journal.json`: idx 0–4, tags `0000_phase1_identity_gallery` … `0004_phase5_notifications_audit`, `breakpoints: true`.

Snapshot chain (`id` → next `prevId`):

| File | id | prevId |
|---|---|---|
| `0000_snapshot.json` | `860eb19c-…` | `00000000-0000-0000-0000-000000000000` |
| `0001_snapshot.json` | `5edaba85-…` | `860eb19c-…` |
| `0002_snapshot.json` | `49688fdc-…` | `5edaba85-…` |
| `0003_snapshot.json` | `b361d2b5-…` | `49688fdc-…` |
| `0004_snapshot.json` | `18c3d008-…` | `b361d2b5-…` |

Chain is contiguous. **PASS**

| Migration | Creates | Enums | Destructive SQL | Phase isolation |
|---|---|---|---|---|
| `0000` | 10 tables + Auth FK | 4 | None (`DROP`/`TRUNCATE` absent) | Phase 1 only. **PASS** |
| `0001` | 3 tables | 0 | None | Phase 2 only. **PASS** |
| `0002` | 3 tables | 2 | None | Phase 3 only. **PASS** |
| `0003` | 4 tables | 4 | None | Phase 4 only. **PASS** |
| `0004` | 2 tables | 1 | None | Phase 5 only. **PASS** |

`CREATE TABLE` count: 10+3+3+4+2 = 22. No duplicate table names across files. **PASS**

**Auth FK tracking (PARTIAL)**

- Present in `0000_phase1_identity_gallery.sql` line 142:  
  `ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_auth_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade`
- Absent from `profiles.schema.js`
- Absent from every snapshot (`grep auth.users` over `meta/` = no matches); `0004` `public.profiles.foreignKeys` is `{}`

**Future `drizzle-kit generate`:** diffs schema vs latest snapshot. Neither contains the Auth FK, so generate will **not** emit `DROP CONSTRAINT`. Risk: if migrations are squashed or rebuilt from snapshots, the Auth FK **would be omitted**. **PARTIAL** (SQL correct; kit metadata incomplete)

`drizzle.config.js` uses `schema: './src/db/schema/*.js'` and `out: './src/db/migrations'`. Compatible with PostgreSQL + Drizzle Kit 0.31. **PASS**

This audit did not run `drizzle-kit migrate`. Application to Supabase: **NOT IMPLEMENTED** / not performed.

---

## 13. Security review

| Control | Evidence | Verdict |
|---|---|---|
| No passwords on `profiles` | `0000` L110–118; `profiles.schema.js` L11–24 | **PASS** |
| No email source-of-truth column | Same | **PASS** |
| Secrets not in schema files | No connection strings in `src/db/schema` | **PASS** |
| `.env.example` placeholders only | `backend/.env.example` L5–8 | **PASS** |
| Certificates/documents cannot be `public` | CHECK `0000` L50 | **PASS** |
| AR previews store path not public URL | `0001` L5; comments | **PASS** schema; bucket policies **UNVERIFIED** live |
| Customer ownership FKs | `user_id` on addresses, wishlists, orders, previews | **PASS** |
| Admin assignment server-side | Comments only; `auth.middleware.js` is empty | **NOT IMPLEMENTED** |
| No public client-write APIs in schema | Schema cannot grant PostgREST by itself; snapshot `isRLSEnabled: false` | Schema **PASS**; live grants **UNVERIFIED** |
| Express-only access | `database.js` uses `DATABASE_URL` + postgres.js | Intended; role bypass of RLS **UNVERIFIED** |
| Service-role in frontend | Not in schema; frontend not audited here | **UNVERIFIED** (out of DB schema scope) |
| Least-privilege `maison_app` role | Not in migrations; `"roles": {}` in snapshot | **UNVERIFIED** / **NOT IMPLEMENTED** |

Do not assume RLS protects this API connection.

---

## 14. Approved architecture versus implementation

| Freeze decision | Implementation | Verdict |
|---|---|---|
| 22 tables, 5 phases | 22 tables, migrations 0000–0004 | **PASS** |
| CASCADE / RESTRICT / SET NULL map | Actual SQL §5 | **PASS** |
| Composite PKs on two junctions | `0000` L24, L95 | **PASS** |
| Timestamps on addresses, categories, collections | `0000` | **PASS** |
| No generic soft-delete | No `deleted_at` | **PASS** |
| `artist_name`, no artists table | `0000` L62 | **PASS** |
| `full_name` nullable; country default `IN` | `0000` L112, L15 | **PASS** |
| Webhook statuses received/processing/processed/failed | `0003` L4 | **PASS** |
| No raw webhook payload; hash optional | `payload_hash` `0003` L49 | **PASS** |
| Money CHECKs, positive qty, order total identity | `0000`/`0002`/`0003` | **PASS** |
| Unique category/collection slugs | `0000` L88, L107 | **PASS** |
| Unique refund id / courier+tracking when present | `0003` L61, L64 | **PASS** |
| Availability derived, status not stock lock | Comments + columns; not enforced | **PASS** schema / **NOT IMPLEMENTED** runtime |
| Do not expire while payment authorised | Comment only | **NOT IMPLEMENTED** |
| `RESERVATION_TTL_SECONDS` default 900 | Comments only; not in env | **NOT IMPLEMENTED** |
| Outbox retries, `last_error`, nullable `user_id` | `0004` | **PASS** |
| Artwork delete CASCADE wishlist/previews; orders RESTRICT | `0001`/`0002` | **PASS** |
| Refund success does not auto-restock | No restock trigger | **PASS** (intentional absence) |
| JavaScript ESM, Drizzle, no TypeScript | `backend/src/db/schema/*.js` | **PASS** |
| Express-only business data | Config intent | **PASS** design / **UNVERIFIED** live grants |

---

## 15. Missing or incorrectly implemented items

**Incorrect vs freeze:** none found in generated SQL.

**Process / metadata**

1. Auth FK not represented in Drizzle schema or snapshots (`0000` L142 vs `0004_snapshot.json` L1852). **PARTIAL**

**Optional integrity not required by freeze but absent**

2. No `SUM(line totals) = subtotal` CHECK  
3. No refund ≤ payment CHECK  
4. No `currency = 'INR'` CHECK  
5. No at-most-one captured payment per order  
6. No exclusion preventing active reservations exceeding stock  
7. `storage_bucket` not restricted to named buckets  
8. `updated_at` has no PostgreSQL trigger (ORM `$onUpdate` only)

**Not defects:** empty `auth.middleware.js`, no checkout routes, no Razorpay — those were out of scope.

---

## 16. Application-level responsibilities not implemented yet

| Area | Status |
|---|---|
| JWT verification + idempotent profile / customer role / wishlist provisioning | **NOT IMPLEMENTED** |
| Admin role assignment API (trusted ops) | **NOT IMPLEMENTED** |
| Checkout transaction (`FOR UPDATE`, order + items + reservations) | **NOT IMPLEMENTED** |
| Reservation TTL env and expiry worker with payment reconciliation | **NOT IMPLEMENTED** |
| Webhook signature verification and insert-first idempotency handler | **NOT IMPLEMENTED** |
| Duplicate captured-payment detection / refund | **NOT IMPLEMENTED** |
| Exactly-once inventory decrement on capture | **NOT IMPLEMENTED** |
| Razorpay integration | **NOT IMPLEMENTED** |
| Email provider + outbox worker | **NOT IMPLEMENTED** |
| Shipping provider | **NOT IMPLEMENTED** |
| Owner/admin authorization for private media and AR previews | **NOT IMPLEMENTED** |
| Apply migrations to Supabase | **NOT IMPLEMENTED** |
| Least-privilege DB role and audit INSERT-only grants | **NOT IMPLEMENTED** |

---

## 17. Unverified items requiring additional evidence

| Item | Why unverified |
|---|---|
| Whether any migration has been applied on Supabase | Audit did not connect; no apply evidence in repo |
| Privileges of the `DATABASE_URL` role | Typically `postgres` (bypasses RLS); not inspectable from files |
| RLS policies on live tables | Snapshot `isRLSEnabled: false`; live unknown |
| Storage bucket policies (`artwork-previews`, private media) | Task forbade changing Storage; policies not in this repo |
| Append-only enforcement on `audit_logs` | No REVOKE/trigger in migrations |
| Whether `updated_at` is maintained for non-Drizzle writers | SQL default is insert-only |
| Frontend possession of secret keys | Out of schema audit |

---

## 18. Final implementation verdict

**PASS — schema and migrations implement the approved 22-table architecture.**

The JavaScript Drizzle definitions and five SQL migrations are consistent with each other and with the freeze (keys, enums, CHECKs, partial uniques, ON DELETE behaviour, money as bigint paise, no auctions/sellers/artists table/soft-delete). Phase 1 was not rewritten. No destructive SQL is present.

This is **not** a production-ready data plane:

- Migrations are generated, not applied.
- Checkout, payments, webhooks, provisioning, and email remain future Express work.
- Auth FK is correct in SQL but invisible to Drizzle snapshots.
- Role privileges and append-only audit security are unverified.

**Recommended before apply:** confirm the `0000` Auth FK will be included in the migrate run; plan a follow-up so snapshots or a documented custom statement keep that FK if migrations are ever regenerated; do not treat `drizzle-kit check` as proof of live RLS or least privilege.

**Apply to Supabase:** not performed in this audit.
