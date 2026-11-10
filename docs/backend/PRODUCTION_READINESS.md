# Art Backend — Production Readiness

**Date:** 7 November 2026  
**Status:** Prepared. Production has **not** been deployed.  
**Scope:** Express API under `/api/v1`. Payments, shipping-provider integrations, custom domains, and real email delivery are deferred.

This document is the deployment checklist. It does not apply database changes and does not invent credentials.

---

## 1. Current development vs production

| Concern | Development (now) | Production requirement |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `DATABASE_URL` | Session Pooler, `postgres` user | Restricted `maison_app` role |
| `MIGRATION_DATABASE_URL` | Same pooler/`postgres` user | Separate privileged migrator |
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

Existing migration `0005_security_hardening.sql` is already applied. It created `maison_app` as **NOLOGIN**.

Before production:

1. Do **not** rewrite or re-run `0000`–`0005`.
2. Do **not** use `drizzle-kit push`.
3. Review `docs/database/ART_PRODUCTION_ROLE_CUTOVER.sql`.
4. In the Supabase SQL editor, set a password and `LOGIN` for `maison_app` using a password that is **not** stored in this repository.
5. Point `DATABASE_URL` at `maison_app` (shared pooler username form: `maison_app.PROJECT_REF`).
6. Keep `MIGRATION_DATABASE_URL` on a privileged migrator, preferably a direct connection.
7. Re-run `docs/database/ART_DATABASE_SECURITY_VERIFICATION.sql` and `backend/scripts/check-0005-security-hardening.mjs` as a static check.
8. Confirm Express can start and `GET /api/v1/health/db` returns `200`.

Do not apply the cutover SQL from this agent session.

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

CORS uses a single allowlisted origin (`FRONTEND_URL`). Helmet, 1 MB JSON limits, and rate limiting (100 requests / 15 minutes, health excluded) are enabled. Unexpected 500 responses return a generic message.

---

## 5. Deployment checklist (manual)

- [ ] Production secrets stored outside git
- [ ] `maison_app` LOGIN enabled; runtime URL no longer uses `postgres`
- [ ] Migration credentials remain separate
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
