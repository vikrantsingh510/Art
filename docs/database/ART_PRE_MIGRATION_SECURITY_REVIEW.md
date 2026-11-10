# Art Marketplace — Pre-Migration Security and Auth FK Review

**Date:** 5 November 2026  
**Type:** Investigation and recommendation only  
**Constraints honoured:** no schema/migration/.env changes; no Supabase connection; no GRANT/REVOKE executed; no credentials read or printed.

---

## 1. Auth FK tracking — finding and resolution

### 1.1 Finding (verified)

| Location | What is present |
|---|---|
| `backend/src/db/migrations/0000_phase1_identity_gallery.sql` line 142 | `ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_auth_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;` |
| `backend/src/db/schema/profiles.schema.js` | `id` is a UUID primary key only. No `.references()`. Comment at lines 3–6 states the FK is migration SQL because `auth.users` is owned by Supabase Auth. |
| Snapshots `0000_snapshot.json`–`0004_snapshot.json` | `grep` for `auth.users` / `profiles_id_auth` returns **no matches**. |
| `0004_snapshot.json` lines 1851–1857 | `"foreignKeys": {}`, `"policies": {}`, `"isRLSEnabled": false` on `public.profiles`. |
| Drizzle Kit view | `npx drizzle-kit generate --name should_be_noop_auth_fk_probe` reported `profiles 7 columns 0 indexes 0 fks` and **`No schema changes, nothing to migrate`**. Journal still ends at `0004_phase5_notifications_audit`. |

Kit `generate` diffs **JavaScript schema vs the latest snapshot**. It does **not** parse `0000_*.sql` and does **not** inspect a live database. Because neither the schema nor the snapshot contains the Auth FK, generate will not emit `DROP CONSTRAINT` or a second `ADD CONSTRAINT`.

### 1.2 Why Drizzle cannot own this FK safely

Putting `auth.users` into `backend/src/db/schema/*.js` (the glob in `drizzle.config.js` line 6) would make Kit treat it as an application table. `drizzle-orm/supabase` exports `authUsers` as `pgSchema("auth").table("users", …)` **without** `.existing()` on the table (`node_modules/drizzle-orm/supabase/rls.js` lines 9–19). Roles in that file use `.existing()`; the users table does not.

Consequences of importing that helper (or a hand-rolled `auth.users` table) into the schema glob:

- Kit would likely generate `CREATE TABLE "auth"."users"` — attempting to own a Supabase-managed table.
- Kit would also generate `ADD CONSTRAINT` on `profiles.id`, **duplicating** the statement already in `0000` line 142. Apply would fail after 0000 had already created the constraint.

`tablesFilter` / `schemaFilter` in drizzle-kit 0.31 apply to **push and introspect**, not to `generate` (`drizzle-kit/index.d.ts` lines 77–93). They are not a safe way to hide `auth.users` from migration generation.

**Conclusion:** a snapshot/schema representation of this external FK is **not supported** without creating or duplicating Auth objects. Custom SQL ownership is the correct strategy.

### 1.3 Resolution (no file changes in this task)

**Keep the FK only in `0000` SQL.** Do not add `.references()` on `profiles.id`. Do not import `authUsers` from `drizzle-orm/supabase` into `src/db/schema/`. Do not squash or regenerate `0000`. Do not use `drizzle-kit push`.

| Future action | Effect on Auth FK |
|---|---|
| `drizzle-kit generate` (current schema = snapshot) | No-op. Demonstrated 5 Nov 2026: “No schema changes, nothing to migrate”. Will **not** drop or duplicate the FK. |
| `drizzle-kit migrate` | Runs `0000` line 142 once. Creates the CASCADE FK. Subsequent migrations 0001–0004 do not mention it. |
| `drizzle-kit push` | **Unsafe.** Push introspects the live database (`schemaFilter` docs). Live DB would show an extra FK that the schema/snapshot lack → Kit may propose `DROP CONSTRAINT "profiles_id_auth_users_id_fk"`. There is **no** `db:push` script today (`package.json` has `db:generate`, `db:migrate`, `db:studio` only). Keep it that way. |
| `drizzle-kit introspect` | Could rewrite schema from live DB and then generate a drop/add cycle. Do not introspect over this project as a refresh of `src/db/schema`. |
| Editing `profiles.id` in JS (type/default) | Generate emits an `ALTER` on `profiles`. PostgreSQL keeps existing FKs unless the column is dropped. Avoid dropping/recreating `profiles.id`. |
| Adding `.references()` later | High risk of duplicate FK SQL on generate. Do not. |
| Squash / recreate 0000 from snapshot | Snapshot has `foreignKeys: {}`. Recreated 0000 would **omit** the Auth FK. Never squash without manually re-copying line 142. |

ON DELETE CASCADE must stay exactly as in `0000` line 142. This review does not weaken it.

### 1.4 Custom SQL ownership — precautions

1. Treat `0000` line 142 as **hand-owned**. Any future rewrite of that file must keep that statement last (after `profiles` exists).
2. After apply, verify with the SQL in §9. Do not “fix” the snapshot by inserting a fake FK: that would make the **next generate emit DROP**.
3. Runtime Drizzle does not need the FK declared in JS. Inserts into `profiles` still enforce the constraint in PostgreSQL once 0000 has been applied.
4. Migration role (typically `postgres`) needs `REFERENCES` on `auth.users` to **create** the FK. The application role does not need `REFERENCES` to insert child rows.

---

## 2. Current database role assessment

| Question | Repository evidence | Verdict |
|---|---|---|
| How does Express connect? | `backend/src/config/database.js` lines 13–26: `postgres(env.DATABASE_URL, …)`, `application_name: maison-d-art-api` | Role = **whatever user is in `DATABASE_URL`** |
| Env contract | `env.js` requires `DATABASE_URL` as a `postgres(ql):` URL. No username validation. `.env.example` line 6: `postgresql://USER:PASSWORD@HOST:5432/postgres` | Placeholder `USER` |
| Actual username in `.env` | Not read (credentials). | **UNVERIFIED** |
| Typical Supabase URI | Project connection strings commonly use `postgres` (direct) or a pooler user. `postgres` is a superuser and **bypasses RLS**. | Likely, **UNVERIFIED** for this project |
| Separate app vs migrate URLs | Single `DATABASE_URL` for Express and `drizzle.config.js` `dbCredentials.url` | One role for runtime and Kit |
| `maison_app` | Not in schema, migrations, or env | **NOT IMPLEMENTED** |

**Live privileges of that role: UNVERIFIED** (no Supabase connection in this task).

---

## 3. RLS and PostgREST access assessment

### 3.1 What the repo actually creates

All five migrations contain **zero** of: `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, `CREATE ROLE`, `GRANT`, `REVOKE`, `FORCE ROW LEVEL SECURITY`.

Snapshot `0004_snapshot.json`: every table `"isRLSEnabled": false`; top-level `"roles": {}`, `"policies": {}` (lines 2529–2530). No `enableRLS()` / `pgPolicy` in `backend/src/db/schema`.

Comments in schema files are not security.

### 3.2 anon / authenticated

- Not referenced in application SQL.
- After `CREATE TABLE` in `public`, **Supabase project default privileges** decide whether `anon` and `authenticated` receive `SELECT`/`INSERT`/`UPDATE`/`DELETE`.
- Those defaults are **project-specific** and **UNVERIFIED** without querying `information_schema.role_table_grants` on the live database.

If this project still has the common `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT … TO anon, authenticated` (or `GRANT ALL ON TABLES IN SCHEMA public` to those roles), then applying 0000–0004 **would expose all 22 business tables through PostgREST** using only the publishable key. That is a known Supabase behaviour. It is **not proven** for this project.

Disabling RLS does **not** make tables private. It only means there is no extra row filter. Table **GRANTs** control PostgREST.

### 3.3 Does the current role bypass RLS?

- If `DATABASE_URL` is `postgres` (typical): **yes**, table owner/superuser bypasses RLS unless `FORCE ROW LEVEL SECURITY`.
- Actual user: **UNVERIFIED**.
- RLS is not enabled on these tables in migrations anyway, so bypass is currently moot.

### 3.4 Is Express-only access enforced?

| Layer | Evidence | Enforced? |
|---|---|---|
| Express routes | `backend/src/routes/index.js` mounts only `/health`. Health `/db` runs `select 1` (`health.routes.js` lines 17–19). No table CRUD APIs. | Yes, vacuously, for **this Node app** |
| Auth middleware | `auth.middleware.js` is empty | No JWT gate |
| Schema / migrations | No REVOKE from `anon`/`authenticated` | **No** |
| Frontend | No `createClient` / Supabase JS usage in the repo. Publishable key is validated in backend env and **not used** by any code path found. | No PostgREST client in-repo; **UNVERIFIED** for code outside this workspace |
| PostgREST | Enabled on every Supabase project by default | **UNVERIFIED** grants after migrate |

**Express-only is an architecture intention, not a database control.** Applying migrations without a privilege lockdown does not enforce it.

---

## 4. Table privilege matrix

**Live GRANT state: UNVERIFIED.** Matrix below is **repository-implied after migrate**, assuming only the SQL in 0000–0004 (no extra grants in-repo).

| Table | RLS in migrations | Policies | Explicit GRANT/REVOKE | anon / authenticated | Connecting `DATABASE_URL` role | `user_roles` client-write | Notes |
|---|---|---|---|---|---|---|---|
| All 22 public tables | Off | None | None | **UNVERIFIED** (project defaults) | Full DML+DDL if `postgres` | N/A | |
| `audit_logs` | Off | None | None | **UNVERIFIED** | UPDATE/DELETE possible | — | Not append-only |
| `user_roles` | Off | None | None | **UNVERIFIED** | Full DML | **Not protected** | Comments only (`user-roles.schema.js` 5–8) |
| `orders`, `payments`, `refunds`, `webhook_events` | Off | None | None | **UNVERIFIED** | DELETE possible | — | RESTRICT FKs ≠ REVOKE DELETE |
| `artwork_previews`, addresses, profiles | Off | None | None | **UNVERIFIED** | Full DML | — | Private data if PostgREST can SELECT |

PostgreSQL `ON DELETE RESTRICT` stops **parent** deletes from removing children. It does **not** stop `DELETE FROM orders`. Hard-delete protection is **not** a privilege.

---

## 5. Audit-log immutability assessment

| Claim | Evidence | Verdict |
|---|---|---|
| Append-only in SQL | `audit-logs.schema.js` lines 4–6 are comments. `0004_phase5_notifications_audit.sql` creates a normal table (lines 2–11) plus INSERT-capable FKs. No trigger, no `REVOKE UPDATE, DELETE`. | **Not technically append-only** |
| Actor SET NULL | `0004` line 31 `ON DELETE set null` | **PASS** (FK behaviour only) |
| App role cannot UPDATE/DELETE | No role object, no REVOKE | **UNVERIFIED** / **NOT IMPLEMENTED** |
| Bypass via `postgres` | Superuser can always UPDATE/DELETE | **UNVERIFIED** (depends on `DATABASE_URL` user) |

`user_roles` is likewise unprotected against INSERT of `admin` by anyone who can reach the table (PostgREST or a leaked DB URL). Empty `auth.middleware.js` does not help.

---

## 6. Recommended least-privilege architecture

Evaluate the requested target against this codebase.

| Target | Feasible? | Notes |
|---|---|---|
| Dedicated `maison_app` LOGIN role | Yes | Not created yet |
| No business-table access for `anon` / `authenticated` | Yes | Explicit `REVOKE` + default-privilege revoke required; do not rely on RLS off |
| Express-only business access | Yes | Keep CRUD on Express; do not grant PostgREST |
| Frontend: publishable key for Auth only | Yes | No service-role / `DATABASE_URL` in frontend. Backend already validates `sb_publishable_` |
| Least-privilege backend grants | Yes | See §7 |
| INSERT-only `audit_logs` | Yes | `SELECT, INSERT`; no UPDATE/DELETE |
| No UPDATE/DELETE on financial history | **Conflict** | Freeze requires **status updates** on `orders`, `payments`, `refunds`, `inventory_reservations`, `shipments`. Recommend **no DELETE**, allow **UPDATE** on lifecycle columns. True immutability would need event tables this schema does not have. |
| RLS as defense in depth | Yes, with care | Enable RLS **without** policies for `anon`/`authenticated`. Give `maison_app` either `BYPASSRLS` **or** `FOR ALL TO maison_app USING (true)` policies. Do **not** `FORCE ROW LEVEL SECURITY` while migrations still run as table owner without a policy. |
| Stop using `postgres` for ordinary API traffic | Yes | Keep a **migration** URL with CREATE privileges; point Express `DATABASE_URL` at `maison_app` later. Drizzle ORM DML works with `maison_app`. `drizzle-kit migrate` does **not** (needs CREATE TYPE/TABLE). |

### Can Drizzle use `maison_app`?

- **Runtime (`database.js`):** yes, once grants exist. Same postgres.js client.
- **Kit migrate / generate:** generate does not need DB DDL privileges for schema-vs-snapshot; **migrate applies SQL** and needs a role that can `CREATE TYPE/TABLE/INDEX` and add the Auth FK (`REFERENCES auth.users`). That should remain `postgres` (or a dedicated migrator), not `maison_app`.

Do not point `drizzle.config.js` `dbCredentials` at a least-privilege app role until migrate is split from runtime.

---

## 7. Exact SQL / migration changes required (not applied)

**Do not execute these now.** They are the permission set to review before a future Phase-security migration (for example `0005`). Passwords must not be committed.

### 7.1 Do not change 0000–0004

No Auth FK edit. No squash.

### 7.2 Future security migration (draft)

Run as a privileged migrator **after** 0000–0004, or as the first action in the same apply window.

```sql
-- Role (password from secret store, not git)
CREATE ROLE maison_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

GRANT CONNECT ON DATABASE postgres TO maison_app;
GRANT USAGE ON SCHEMA public TO maison_app;
GRANT USAGE ON TYPE
  user_role, artwork_status, media_type, media_access_level,
  order_status, reservation_status, payment_status, refund_status,
  shipment_status, webhook_processing_status, notification_status
TO maison_app;

-- Close PostgREST
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

-- Catalogue (admin + public-read via Express, not PostgREST)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  artworks, categories, artwork_categories, collections, collection_artworks,
  artwork_images, artwork_media
TO maison_app;

-- Identity / customer-owned
GRANT SELECT, INSERT, UPDATE, DELETE ON
  profiles, addresses, wishlists, wishlist_items, artwork_previews
TO maison_app;

-- Roles: no self-service UPDATE of privilege rows; INSERT for provisioning + admin assign
GRANT SELECT, INSERT ON user_roles TO maison_app;

-- Financial / fulfilment: UPDATE for status, no DELETE
GRANT SELECT, INSERT, UPDATE ON
  orders, order_items, inventory_reservations, payments, refunds,
  shipments, webhook_events, notification_outbox
TO maison_app;

-- Audit: append + read
GRANT SELECT, INSERT ON audit_logs TO maison_app;

-- Defense in depth: RLS on, no policy for anon/authenticated
-- Repeat for every public business table:
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY maison_app_profiles ON profiles
  FOR ALL TO maison_app USING (true) WITH CHECK (true);
-- …same pattern for the other 21 tables…
```

Do **not** `FORCE ROW LEVEL SECURITY` in the first pass (would also constrain the table owner during migrate).

Optional stricter variant: `GRANT maison_app TO` no one; omit table policies; `ALTER ROLE maison_app BYPASSRLS` — simpler, weaker DiD.

### 7.3 Auth FK

No additional SQL if 0000 is applied as written. Optional idempotent check (ops, not a second constraint):

```sql
SELECT conname, confdeltype
FROM pg_constraint
WHERE conname = 'profiles_id_auth_users_id_fk';
-- confdeltype 'c' = CASCADE
```

### 7.4 Env (later, not this task)

- Keep migrator URL on `postgres`.
- Point Express at `maison_app`.
- Frontend: `SUPABASE_URL` + publishable key only, Auth SDK only.

---

## 8. Risks and operational consequences

| Risk | Consequence |
|---|---|
| Apply 0000–0004 with default public GRANTs | PostgREST may expose profiles, orders, payments, refunds, AR previews, `user_roles` via the publishable key | **High** |
| `drizzle-kit push` | May drop `profiles_id_auth_users_id_fk` | **High** for identity integrity |
| Import `authUsers` into schema glob | Kit may emit `CREATE TABLE auth.users` and a **duplicate** FK | **High** |
| Squash 0000 from snapshot | Auth FK disappears | **High** |
| Enable RLS with no policy and switch Express to `maison_app` without grants/policies | API reads return zero rows / permission denied | **High** operational |
| `FORCE RLS` while migrating as owner without policies | Migrate/DML as `postgres` can fail | **High** |
| INSERT-only financial tables | Cannot update `orders.status` / capture payments | Breaks freeze workflows |
| Comments as security | `user_roles` and `audit_logs` remain writable if the role or PostgREST can reach them | False confidence |
| Single `DATABASE_URL` as `postgres` after go-live | RLS DiD is bypassed; DELETE on financial tables remains possible | Privilege goal unmet |

---

## 9. Verification commands

**Do not paste connection strings or passwords.** Run from `backend/` with env already loaded locally.

### Auth FK / generate (safe now, no apply)

```bash
npx drizzle-kit generate --name should_be_noop
# Expect: No schema changes, nothing to migrate
# Expect in table list: profiles … 0 fks
```

```bash
# Confirm 0000 still owns the FK
rg "profiles_id_auth_users_id_fk" src/db/migrations
# Expect a single hit: 0000_phase1_identity_gallery.sql
```

```bash
rg "auth\\.users|profiles_id_auth" src/db/migrations/meta
# Expect no snapshot matches
```

### After a future apply (not run in this task)

```sql
SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'profiles_id_auth_users_id_fk';

SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'public', 'maison_app', 'postgres')
ORDER BY table_name, grantee, privilege_type;

SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r';
```

Never print `DATABASE_URL`.

---

## 10. Final recommendation

**NOT READY FOR MIGRATION**

**Auth FK:** resolved as **custom-SQL ownership**. Keep `0000` line 142. Do not put `auth.users` in the Drizzle schema glob. `drizzle-kit generate` on the current tree is a no-op and will not drop or duplicate the constraint. That finding **does not block** migrate **if** operators follow generate+migrate and never push/introspect-rewrite.

**Security:** **blocks** apply to a shared/production Supabase project. Migrations create 22 public tables with RLS off and no REVOKE. Whether `anon`/`authenticated` can read customer, order, payment, and AR-preview rows is **UNVERIFIED** and, on many Supabase projects, likely **yes**. `audit_logs` is not append-only. `user_roles` is not protected against client-side modification at the database layer. Express-only access is not enforced by PostgreSQL.

**Minimum before READY FOR MIGRATION**

1. Author a reviewed privilege/RLS migration (draft in §7) — still not applied in this task.
2. Apply plan: migrator role runs 0000–0004 then the security migration in one controlled window; immediately run the grant/RLS queries in §9.
3. Confirm `anon` and `authenticated` have **no** privileges on business tables.
4. Keep `drizzle-kit push` unused.
5. Split migrator vs `maison_app` connection URLs before production traffic.

Schema objects themselves are consistent with the architecture freeze. Privilege isolation is not. Do not apply 0000–0004 to Supabase until the security migration is approved.
