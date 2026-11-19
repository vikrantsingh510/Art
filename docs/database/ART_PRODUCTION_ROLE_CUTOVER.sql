-- Art Marketplace — production runtime role cutover
-- Status: APPLIED on the live project. maison_app LOGIN is enabled.
-- Express DATABASE_URL connects as maison_app. Do not re-run this file
-- to change the password or re-issue LOGIN unless restoring a backup.
--
-- Purpose (historical): enable LOGIN for maison_app so Express can
-- connect without using postgres. Migration 0005 created maison_app
-- as NOLOGIN; 0012 (provision_customer_role) was applied before LOGIN.
-- This file does not apply migrations and does not enable LOGIN by default
-- (the ALTER ROLE line stays commented).
--
-- DO NOT run this file from application code, CI, or an agent session.
-- DO NOT rewrite or re-apply migrations 0000-0005.
-- DO NOT use drizzle-kit push.
-- DO NOT put the password in git, logs, or frontend code.
--
-- Manual steps (privileged dashboard / migrator session):
-- 1. Choose a strong password. Keep it only in the secret store.
-- 2. Replace PASSWORD_FROM_SECRET_STORE below, then run in the SQL editor.
-- 3. Point DATABASE_URL at maison_app (Session Pooler username:
--    maison_app.PROJECT_REF). Keep MIGRATION_DATABASE_URL on a privileged role.
-- 4. Verify GET /api/v1/health/db as the application.
-- 5. Re-run ART_DATABASE_SECURITY_VERIFICATION.sql.

BEGIN;

DO $$
DECLARE
  role_exists boolean;
  can_login boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'maison_app') INTO role_exists;
  IF NOT role_exists THEN
    RAISE EXCEPTION 'maison_app does not exist. Do not continue; 0005 must already be applied.';
  END IF;

  SELECT rolcanlogin INTO can_login FROM pg_roles WHERE rolname = 'maison_app';
  IF can_login THEN
    RAISE NOTICE 'maison_app already has LOGIN. No password change is performed by this file.';
  ELSE
    RAISE NOTICE 'maison_app is NOLOGIN. An operator must set LOGIN and a password outside this repository.';
  END IF;
END
$$;

-- Operator-only (uncomment in the dashboard after substituting the password):
-- ALTER ROLE maison_app WITH LOGIN PASSWORD 'PASSWORD_FROM_SECRET_STORE';

COMMIT;
