# Art Backend — Production Readiness

**Date:** 19 November 2026
**Status:** Database role cutover is complete on the live Supabase project. Hosted Vercel frontend + Render backend have **not** been deployed.
**Scope:** Express API under `/api/v1`. Payments, shipping-provider integrations, custom domains, and real email delivery are deferred.

This document is the deployment checklist. It does not apply database changes and does not invent credentials.

---

## 1. Current development vs production

| Concern | Development (now) | Production requirement |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `DATABASE_URL` | Live local process: `maison_app` | Keep `maison_app` on Render (shared pooler username `maison_app.PROJECT_REF`) |
| `MIGRATION_DATABASE_URL` | Privileged `postgres` (Kit only) | Keep separate; never the Render runtime URL |
| Email | Mock adapter | Mock until a provider is chosen |
| CORS origin | `FRONTEND_URL` (localhost is acceptable in development) | Storefront HTTPS origin, not localhost |
| `TRUST_PROXY` | `0` | `1` behind a reverse proxy |
| Payments / shipping | Code preserved, inactive | Deferred |

---

## 2. Environment variables

Required at Express startup (see `backend/.env.example`):

- `NODE_ENV=production`
- `PORT` — container/platform listen port
- `FRONTEND_URL` — exact storefront origin used by CORS
- `DATABASE_URL` — `maison_app` runtime connection (Session Pooler is acceptable if the username is `maison_app.PROJECT_REF`)
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` — must start with `sb_publishable_`

Optional:

- `RESERVATION_TTL_SECONDS` — default `900`
- `TRUST_PROXY` — set `1` when a proxy terminates TLS
- `MIGRATION_DATABASE_URL` — **not** read by Express; required only for Drizzle Kit
- `RAZORPAY_*` — deferred; leave empty
- Email/shipping provider secrets — deferred; do not add until authorized

Never put `DATABASE_URL`, `MIGRATION_DATABASE_URL`, service-role keys, or payment secrets in frontend code.

Validate without printing secrets:

```bash
cd backend
npm run check:production-env
```

A non-zero exit means production runtime credentials are not ready. Warnings about deferred Razorpay/email/shipping are expected.

---

## 3. Database permission separation (manual)

Live status (verified):

- Migrations `0000`–`0012` are applied. Do **not** re-run them. Do **not** use `drizzle-kit push`.
- `maison_app` LOGIN is enabled. Restrictive flags (no SUPERUSER / CREATEDB / CREATEROLE / REPLICATION / INHERIT / BYPASSRLS) were verified.
- Express `DATABASE_URL` connects as `maison_app` (`current_user` and `session_user`).
- `MIGRATION_DATABASE_URL` remains privileged `postgres`. Future application DDL must use that migrator, not `maison_app` and not the Dashboard table editor.
- First-login uses `public.provision_customer_role`. `maison_app` still has no table INSERT on `user_roles`.
- Google login, admin access, and new customer registration were tested successfully against this role.

`docs/database/ART_PRODUCTION_ROLE_CUTOVER.sql` is the historical LOGIN procedure. The `ALTER ROLE` line stays commented. Do not re-issue LOGIN or a password change unless restoring a backup.

Before **hosted** production (Render):

1. Keep Render `DATABASE_URL` on `maison_app` (shared pooler username form: `maison_app.PROJECT_REF`).
2. Do not put `MIGRATION_DATABASE_URL` on the Render runtime service.
3. Set `FRONTEND_URL` to the Vercel HTTPS origin (not localhost).
4. Set `TRUST_PROXY=1` on Render.
5. Confirm `GET /api/v1/health` and `GET /api/v1/health/db`.
6. Optionally re-run `docs/database/ART_DATABASE_SECURITY_VERIFICATION.sql` as read-only checks. Query 1 expects `maison_app.rolcanlogin = true`.

---

## 4. Backend deployment configuration

The API is a standard Node.js process:

```bash
cd backend
npm ci --omit=dev
NODE_ENV=production npm start
```

`backend/Dockerfile` is a starting image. It copies application source only; it does not bake `.env`. Inject secrets from the host/platform.

Health checks:

- Liveness: `GET /api/v1/health`
- Readiness: `GET /api/v1/health/db`

CORS uses a single allowlisted origin (`FRONTEND_URL`). Helmet and 1 MB JSON body limits are enabled. `TRUST_PROXY` must stay `0` unless a reverse proxy is actually in front. Unexpected 500 responses return a generic message.

### Protection model

Express does **not** apply request-count rate limits to application APIs. Catalogue reads, `/auth/me`, admin dashboard and artwork CRUD, cart, wishlist, addresses, and orders are not capped by an IP or user request budget.

Abuse protection that remains:

- **Login / OTP / password recovery:** Google OAuth and session issuance are handled by **Supabase Auth**. Express has no login, OTP, or password-recovery routes. Do not invent them.
- **Contact form:** storefront `mailto:` only; there is no contact or ticketing API to rate-limit.
- **JWT and authorization:** `requireAuth` verifies the Supabase access token on each request and loads roles from `user_roles`. `requireAdmin` is server-side. Client-supplied `isAdmin` / `role` values are ignored. Identity is stored on `req.user` for that request only — there is no process-wide authenticated-user cache.
- **Artwork uploads:** live Storage bucket MIME and file-size constraints, the five-image catalogue cap, `requireAdmin`, and Storage RLS. Deletion stays Storage-first and retryable. These are resource checks, not request-count caps.
- **Body size:** 1 MB JSON / urlencoded limit.
- **Upstream 429:** Supabase Auth or Storage may still return 429. The frontend treats that as a recoverable pause (no sign-out, no automatic retry loop).

---

## 5. Deployment checklist (manual)

- [ ] Production secrets stored outside git
- [x] `maison_app` LOGIN enabled; local runtime URL is `maison_app`, not `postgres`
- [x] Migration credentials remain separate (`MIGRATION_DATABASE_URL` = `postgres`)
- [ ] `FRONTEND_URL` is the real storefront origin
- [ ] `TRUST_PROXY` set if a reverse proxy is used
- [ ] `npm test` passes on the release commit
- [ ] `npm run check:production-env` exits 0 with production env
- [ ] Health and health/db probed after start
- [ ] Mock email confirmed (no Resend/domain required)
- [ ] Payments and shipping providers still deferred
- [ ] Explicit authorization obtained before any production deploy

---

## 6. Notifications in production (current MVP)

Transactional email uses `notification_outbox` plus the mock adapter. Admin `POST /api/v1/admin/notifications/process` drains due rows. Duplicate sends are prevented by `idempotency_key`. Real provider integration remains deferred until a domain and vendor are chosen.
