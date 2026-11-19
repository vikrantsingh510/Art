# Art Marketplace — Database Security Hardening

**Date:** 19 November 2026
**Status:** Live Supabase is hardened through migration `0012`. `maison_app` LOGIN is enabled. Express `DATABASE_URL` connects as `maison_app`. `MIGRATION_DATABASE_URL` remains the privileged `postgres` migrator. Hosted Vercel/Render production has **not** been deployed from this document.

This document describes the architecture in `backend/src/db/migrations/0005_security_hardening.sql`, customer provisioning in `0012_provision_customer_role.sql`, and the split between `DATABASE_URL` and `MIGRATION_DATABASE_URL`. Do **not** re-run applied migrations `0000`–`0012`.

---

## 1. Current verified security findings

**Current live project (operator-verified, 19 November 2026):** migrations `0000`–`0012` are applied; `maison_app` has LOGIN with `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOINHERIT`, `NOBYPASSRLS`; `maison_app` is not a member of `postgres` / `service_role` / `supabase_admin`; Express runtime `current_user` / `session_user` are `maison_app`; first-login customer registration, Google login, and admin access succeeded. `postgres` remaining an ADMIN member of `maison_app` (grantor `supabase_admin`, INHERIT/SET false) is the expected PostgreSQL 16+ platform membership.

The table below is the **first** pre-table inspection (5 November 2026). It is historical. Do not treat “`maison_app` did not exist” or “`DATABASE_URL` unverified” as the current live state.

From that first read-only live inspection (before any application tables existed) and from this repository:

| Finding | Evidence | Verdict |
|---|---|---|
| `anon` exists, no login, no `BYPASSRLS` | Live role query | Verified live |
| `authenticated` exists, no login, no `BYPASSRLS` | Live role query | Verified live |
| `postgres` can login, create roles/databases, `BYPASSRLS` | Live role query | Verified live |
| `service_role` has no direct login, `BYPASSRLS` enabled | Live role query | Verified live |
| `maison_app` did not exist | Live role query | Verified live at inspection; created in **unapplied** `0005` |
| `public` schema USAGE for `PUBLIC`, `anon`, `authenticated` | Live schema ACL | Verified live |
| `postgres` default ACLs: `anon`/`authenticated` have MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on **future** tables; no SELECT/INSERT/UPDATE/DELETE entries were visible | Live default ACL | Verified live |
| `supabase_admin` default ACLs: `anon`/`authenticated` have DELETE, INSERT, SELECT, TRIGGER, TRUNCATE, UPDATE on **future** tables that **that owner** creates | Live default ACL | Verified live |
| `role_table_grants` for the 22 application tables | Zero rows because tables were not created yet | Do **not** claim the 22 tables are currently exposed |
| Application RLS / GRANT / REVOKE in `0000`–`0004` | None | Verified in repo |
| Auth FK `profiles.id → auth.users(id) ON DELETE CASCADE` | `0000_phase1_identity_gallery.sql` only; absent from snapshots | Custom SQL, preserved |
| Express business APIs | Health routes only | No table CRUD yet |
| `auth.middleware.js` | Empty foundation | No request authorization yet |
| Actual `DATABASE_URL` username | Not read | **UNVERIFIED** |

Schema USAGE is not table DML. Table access after migrate depends on table owner plus default privileges of **that owner**.

---

## 2. Target security architecture

- Express is the only business-data client.
- Frontend may hold the Supabase publishable key for Auth only. It must not hold `DATABASE_URL`, `MIGRATION_DATABASE_URL`, or the service-role key.
- Runtime database identity is `maison_app` (least privilege, no `BYPASSRLS`).
- Migration identity is a trusted administrator (typically `postgres` over a **direct** connection).
- `anon` and `authenticated` must have no privileges on the 22 application tables.
- `service_role` must have no privileges on those 22 tables (blocks PostgREST service-role access to business data).
- RLS is enabled on the 22 tables with policies **only** for `maison_app`. No policies for `anon`, `authenticated`, or `PUBLIC`.
- `audit_logs` is INSERT + SELECT for runtime, with a trigger rejecting UPDATE/DELETE.
- `user_roles` is SELECT-only for runtime. Admin assignment is a trusted operator procedure.
- Future tables require an explicit security review and explicit grants/policies. Default privileges do **not** auto-grant `maison_app` or client roles.

RLS does not replace SQL GRANTs. GRANTs do not replace Express authorization.

---

## 3. Runtime versus migration identity

| Concern | Runtime | Migration / Kit |
|---|---|---|
| Environment variable | `DATABASE_URL` | `MIGRATION_DATABASE_URL` |
| Consumer | `backend/src/config/database.js` | `backend/drizzle.config.js` |
| Required for Express startup | Yes | **No** |
| Required for `db:generate` / `db:migrate` / `db:studio` | No | Yes (clear error if missing) |
| Target role after hardening | `maison_app` | Trusted migrator, typically `postgres` |
| Must not be | `postgres`, `service_role`, `supabase_admin` | `maison_app` (cannot CREATE TYPE/TABLE or the Auth FK) |

`env.js` validates `DATABASE_URL` only. Kit loads dotenv itself and validates `MIGRATION_DATABASE_URL` only. Kit no longer imports the Express env module.

**URI format (from [Supabase connection docs](https://supabase.com/docs/guides/database/connecting-to-postgres), not guessed):**

Copy host and port from Dashboard → Connect. Do not compose the shared pooler host from the region.

| Mode | Username | Typical URI shape |
|---|---|---|
| Direct (recommended for persistent Express and for migrations) | role name only: `maison_app` or `postgres` | `postgresql://maison_app:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres` |
| Shared pooler, session (`:5432`) | `[ROLE].[PROJECT-REF]` | `postgresql://maison_app.PROJECT_REF:PASSWORD@POOLER_HOST:5432/postgres` |
| Shared pooler, transaction (`:6543`) | `[ROLE].[PROJECT-REF]` | `postgresql://maison_app.PROJECT_REF:PASSWORD@POOLER_HOST:6543/postgres` |
| Dedicated pooler (Pro+, `:6543` on `db.` host) | role name only | `postgresql://maison_app:PASSWORD@db.PROJECT_REF.supabase.co:6543/postgres` |

Using `maison_app` without `.PROJECT_REF` on the **shared** pooler yields `Tenant or user not found`. Direct and dedicated pooler usernames must **not** include the project ref.

Migrations should use a **direct** connection. This project already sets `prepare: false` on the runtime postgres.js client (compatible with transaction pooling if operators later choose it).

---

## 4. `maison_app` role attributes

Created in `0005` with an existence check:

- `NOLOGIN` initially (password and LOGIN are a manual SQL Editor step)
- `NOSUPERUSER`
- `NOCREATEDB`
- `NOCREATEROLE`
- `NOREPLICATION`
- `NOINHERIT`
- `NOBYPASSRLS`

If `maison_app` is absent, `0005` creates it with those attributes. If it already exists, `0005` **verifies** the same seven attributes and **raises an exception** when any of them is wrong. It does **not** `ALTER ROLE` or enable LOGIN. A namesake that can log in, inherit, replicate, bypass RLS, or create roles/databases will stop the migration until operators fix or drop that role manually.

After create-or-verify, `0005` inspects `pg_catalog.pg_auth_members` for rows where `maison_app` is the **member**. Membership in **any** other role (not only `postgres`, `service_role`, or `supabase_admin`) raises an exception and stops the migration. `0005` does **not** `GRANT` role membership, and it does **not** silently `REVOKE` existing memberships.

No password appears in migrations, source, `.env.example`, or docs examples as a real secret. Placeholders only.

`0005` does **not** grant `maison_app` membership in `postgres`, `service_role`, `supabase_admin`, or any other role.

---

## 5. All 22 table permissions

Verified table names from `0000`–`0004` `CREATE TABLE` and `backend/src/db/schema`:

| Table | maison_app | anon | authenticated | service_role | PUBLIC |
|---|---|---|---|---|---|
| `profiles` | SELECT, INSERT, UPDATE | none | none | none | none |
| `user_roles` | SELECT | none | none | none | none |
| `addresses` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `artworks` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `categories` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `artwork_categories` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `collections` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `collection_artworks` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `artwork_images` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `artwork_media` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `wishlists` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `wishlist_items` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `artwork_previews` | SELECT, INSERT, UPDATE, DELETE | none | none | none | none |
| `orders` | SELECT, INSERT, UPDATE | none | none | none | none |
| `order_items` | SELECT, INSERT, UPDATE | none | none | none | none |
| `inventory_reservations` | SELECT, INSERT, UPDATE | none | none | none | none |
| `payments` | SELECT, INSERT, UPDATE | none | none | none | none |
| `refunds` | SELECT, INSERT, UPDATE | none | none | none | none |
| `shipments` | SELECT, INSERT, UPDATE | none | none | none | none |
| `webhook_events` | SELECT, INSERT, UPDATE | none | none | none | none |
| `notification_outbox` | SELECT, INSERT, UPDATE | none | none | none | none |
| `audit_logs` | SELECT, INSERT | none | none | none | none |

No DELETE on financial records, orders, webhook events, notification records, or audit logs.

**Additional non-table grants (justified):**

- `CONNECT` on the current database and `USAGE` on schema `public` — required to reach tables. Schema USAGE for `anon`/`authenticated` is **not** revoked.
- `USAGE` on the 11 application enum types — INSERT/UPDATE of enum columns requires type USAGE. `PUBLIC` type USAGE is not revoked.

No sequences exist for these UUID tables (`0005` snapshot `"sequences": {}`). Default sequence privileges are still revoked for future objects created by the migrator.

---

## 6. RLS policy design

`0005` enables RLS on each of the 22 tables and creates command-specific policies **TO maison_app only**.

- No `TO PUBLIC`, `anon`, or `authenticated` policies.
- Policy commands match the GRANT matrix (no DELETE policy where DELETE is not granted; `user_roles` SELECT only; `audit_logs` SELECT + INSERT only).
- `USING (true)` / `WITH CHECK (true)` because Express uses **one shared backend identity**.

**This is a backend trust boundary, not customer-level row isolation.** `maison_app` can read every order, payment, address, and AR preview. Express `requireAuth` / `requireAdmin` enforce ownership and admin checks on each request. Client-supplied `isAdmin` / `role` values are ignored.

FORCE ROW LEVEL SECURITY is **not** enabled. The table owner (migration role) bypasses RLS, which is required for `drizzle-kit migrate`. `maison_app` is not the owner and has no `BYPASSRLS`.

**Future customer-level RLS:** do not use a process-wide `SET app.user_id`. If request-scoped isolation is added later, use `SET LOCAL` inside the same transaction as the query (for example `SET LOCAL request.jwt.claim.sub = '...'` after verifying the JWT in Express), then policies that read `current_setting('request.jwt.claim.sub', true)`. Session-level SET on a pooled connection would leak identity across requests. Not implemented.

---

## 7. Audit-log immutability controls

Stacked controls in `0005`:

1. GRANT SELECT, INSERT only to `maison_app`.
2. REVOKE ALL from `PUBLIC`, `anon`, `authenticated`, `service_role`.
3. RLS policies for SELECT and INSERT only.
4. Trigger function `prevent_audit_logs_mutation` on BEFORE UPDATE and BEFORE DELETE, `search_path = pg_catalog`, raising `restrict_violation`. INSERT is unaffected.
5. EXECUTE on that function revoked from client roles and `maison_app` (the table owner still runs the trigger).

**Not tamper-proof** against a privileged administrator: table owner / superuser can disable triggers, drop them, or change GRANTs. `postgres` has `BYPASSRLS` (does not bypass triggers) and CREATEROLE. This is defense in depth against the runtime role and PostgREST, not against a compromised migrator.

---

## 8. Admin-role provisioning strategy

`user_roles` is SELECT-only for `maison_app`. Customer signup **cannot** INSERT `customer` or `admin` through the runtime role.

**Admin assignment (manual, trusted migrator / SQL Editor):**

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'admin');
```

Replace the UUID with the existing `profiles.id` / `auth.users.id`. Do not expose this as a public API. Do not grant `maison_app` INSERT later without a new review.

**Customer-role provisioning:** `maison_app` remains SELECT-only on `user_roles`. Direct `INSERT` is still prohibited. Express first-login uses `public.provision_customer_role(p_user_id uuid)` from migration `0012_provision_customer_role.sql` (forward-only). That migration **is applied** on the live database. Do **not** re-run it.

The function:

- is `SECURITY DEFINER` with `SET search_path = pg_catalog, public`
- is owned by the privileged migration role (same model as `current_user_is_admin()`)
- accepts only a profile UUID — not a role name
- does **not** use `auth.uid()` because Express connects with postgres-js as `maison_app` and never sets a PostgREST JWT
- verifies `public.profiles` contains that UUID, then inserts the literal `'customer'` with `ON CONFLICT (user_id, role) DO NOTHING`
- has `EXECUTE` granted only to `maison_app`; `PUBLIC`, `anon`, `authenticated`, and `service_role` are revoked (no PostgREST RPC)

Required order inside `provisionCustomerIdentity`: profile insert → `provision_customer_role` → wishlist/cart. Existing profiles still skip all writes. Admin assignment remains the SQL Editor insert above.

`maison_app` LOGIN **is enabled**. `0012` is applied. Do not re-run `0005` or `0012`. Do not `GRANT INSERT` on `user_roles` to `maison_app`. Re-running `0005` after LOGIN fails the role-attribute check by design.

---

## 9. Default privilege strategy and Supabase owner caveat

`0005` runs:

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
```

That binds to **the role that applies `0005`** (the `MIGRATION_DATABASE_URL` user). It does **not** grant future tables to `maison_app`. New application tables need a reviewed migration with explicit GRANT + RLS.

It does **not** change `supabase_admin` defaults. Those defaults grant client DML on tables **created by `supabase_admin`**. Altering them as `postgres` is often not possible (`must be member of role supabase_admin`) and would affect dashboard-created objects outside this app.

**Rule:** all application DDL must run via `MIGRATION_DATABASE_URL` as the verified migration owner. Do not create business tables in the Dashboard table editor. If a table is accidentally created under `supabase_admin`, assume `anon`/`authenticated` may receive DML until proven otherwise and revoke immediately.

`postgres` defaults observed live already included TRUNCATE/MAINTAIN for client roles. The migrator REVOKE ALL on defaults is intended to remove those for objects **that migrator** creates going forward. Existing non-application public objects are not targeted by table REVOKE (22 tables only).

---

## 10. Auth FK custom SQL ownership

Keep `profiles.id → auth.users(id) ON DELETE CASCADE` only in `0000_phase1_identity_gallery.sql`.

- Not in Drizzle JS (`profiles.schema.js` has no `.references()`).
- Not in snapshots (`0005_snapshot.json` still has empty `foreignKeys` on `profiles`, `isRLSEnabled: false`, empty `policies` / `roles`).
- Do not import `authUsers` from `drizzle-orm/supabase` into `src/db/schema`.
- Do not squash `0000`.

`drizzle-kit generate` diffs JS schema vs the latest snapshot. It will not emit DROP/ADD for the Auth FK, RLS, GRANTs, or audit triggers. Those are hand-owned SQL.

`drizzle-kit push` **would** introspect the live database and may propose dropping the Auth FK, policies, and triggers. There is no `db:push` script. Do not add one. Do not introspect-rewrite this schema.

---

## 11. Manual Supabase configuration steps

**Cutover status:** done on the live project. `0000`–`0012` are applied. `maison_app` LOGIN is enabled. Express `DATABASE_URL` is `maison_app`. `MIGRATION_DATABASE_URL` is the privileged `postgres` connection. Do **not** re-run those migrations. Do **not** re-issue `ALTER ROLE maison_app LOGIN` unless restoring a backup.

Keep:

1. `DATABASE_URL` on `maison_app` (shared pooler username form: `maison_app.PROJECT_REF`).
2. `MIGRATION_DATABASE_URL` as the privileged **direct** `postgres` connection. Future application DDL must use this migrator, not `maison_app` and not the Dashboard table editor (see §9).
3. Frontend: `SUPABASE_URL` + publishable key only. No `DATABASE_URL` or service-role in the browser.
4. No extra PostgREST grants on application tables “to make the dashboard work”.
5. Re-run `docs/database/ART_DATABASE_SECURITY_VERIFICATION.sql` as **read-only** checks after any later privilege change. Query 1: `maison_app.rolcanlogin` is expected **true**; the other `maison_app` flags remain false.

---

## 12. Required environment variables

| Variable | Required by | Notes |
|---|---|---|
| `NODE_ENV` | Express | `development` / `production` / `test` |
| `PORT` | Express | |
| `FRONTEND_URL` | Express | CORS |
| `DATABASE_URL` | Express | Runtime. Live local process uses `maison_app`. Must not be `postgres`. |
| `SUPABASE_URL` | Express env (Auth later) | |
| `SUPABASE_PUBLISHABLE_KEY` | Express env | Must start with `sb_publishable_` |
| `MIGRATION_DATABASE_URL` | Drizzle Kit only | Privileged direct connection. **Not** required for Express. |

Never commit real values. `.env` is not modified by this work.

---

## 13. Security verification SQL queries

Use `docs/database/ART_DATABASE_SECURITY_VERIFICATION.sql` (read-only). Do not paste connection strings into the results.

---

## 14. Rollback considerations

`0005` is privilege/policy SQL, not table drops.

| Rollback action | Effect | Risk |
|---|---|---|
| Leave `0005` applied | Intended state | None if verified |
| `DROP POLICY` / `DISABLE ROW LEVEL SECURITY` | Restores owner-only-or-default access patterns | May re-expose tables if client GRANTs return |
| `GRANT` DML back to `anon`/`authenticated` | Re-opens PostgREST | High |
| `DROP ROLE maison_app` | Fails if grants/policies remain; Express cannot connect | High after cutover |
| Re-run `0005` | Role create/verify is attribute-checked and membership-checked (fails if LOGIN, other flags, or any role membership is wrong); policies DROP IF EXISTS then CREATE | Safe only if `maison_app` still matches the required attributes and has no role memberships |
| Restore pre-`0005` from backup | Loses hardening | Use only if apply failed mid-file |

There is no automatic down-migration. Reverse only with a reviewed SQL script. Do not squash history to undo.

If apply fails after `CREATE ROLE` but before GRANTs, the NOLOGIN role may exist unused. Re-running migrate depends on whether Kit recorded the migration; if it did not, `0005` will reuse that role only when its attributes still match and it is not a member of any other role, then continue with DROP POLICY IF EXISTS and CREATE OR REPLACE function. Re-running after the manual LOGIN step will fail the role check by design.

---

## 15. Remaining limitations and production-readiness checklist

### Remaining limitations

- RLS policies do not isolate customers. Express `requireAuth` / `requireAdmin` enforce per-request authorization.
- Table owner bypasses RLS (no FORCE). Required for `drizzle-kit migrate` as `postgres`.
- `supabase_admin` default privileges are unchanged (Q9). They affect **future** objects created by `supabase_admin`, not the existing `postgres`-owned application tables. Do not Dashboard-create business tables.
- `user_roles` stays SELECT-only for `maison_app`. Customer rows go through applied `provision_customer_role`. Admin assignment remains SQL Editor as the migrator.
- Audit trigger is not proof against a privileged DBA.
- Snapshot metadata still shows `isRLSEnabled: false` and empty policies by design (custom SQL in migrations).
- Hosted Vercel/Render env, production CORS origin, and production OAuth redirects are **not** configured from this document.

### Checklist before hosted production traffic

- [x] `0000`–`0012` applied. Do not re-run them.
- [x] `0012` function + EXECUTE verified; `maison_app` has no INSERT/UPDATE/DELETE on `user_roles`.
- [x] `maison_app` LOGIN enabled; other role flags still restrictive.
- [x] Express `DATABASE_URL` is `maison_app` (verified `current_user` / `session_user`).
- [x] `MIGRATION_DATABASE_URL` remains privileged `postgres`.
- [x] Client DML empty on the 28 Express tables; RLS on; policies `maison_app` only.
- [ ] Hosted `FRONTEND_URL` / `NEXT_PUBLIC_API_BASE_URL` are the real Vercel and Render origins (not localhost).
- [ ] Production Google OAuth redirect URLs include the Vercel origin.
- [ ] No `drizzle-kit push`.
- [ ] Frontend has no database URL or service-role key.
- [ ] Future tables get explicit GRANT + RLS in the same migration, applied only via `MIGRATION_DATABASE_URL`.

**Live database role cutover:** complete.
**Hosted production deploy:** not done from this document.
