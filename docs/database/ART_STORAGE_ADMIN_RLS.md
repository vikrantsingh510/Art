# Storage admin RLS — `user_roles` helper (0007)

Aligns `artwork-images` INSERT with Express: admin is `public.user_roles`, not JWT `app_metadata.role`.

## Statement notes (`0007_storage_admin_from_user_roles.sql`)

| Statement | Why |
|---|---|
| `CREATE FUNCTION public.current_user_is_admin()` | Boolean self-check: `user_id = auth.uid()` and `role = 'admin'`. No arguments, so it cannot look up another user or accept a role name. |
| `LANGUAGE sql STABLE SECURITY DEFINER` | Runs as the migration owner (`postgres` in development), who can `SELECT user_roles` despite RLS that only names `maison_app`. SQL (not plpgsql) and STABLE keep the body a single `EXISTS`. |
| `SET search_path = pg_catalog, public` | Stops search-path capture of a malicious `user_roles` or `auth.uid` in another schema. |
| `REVOKE ALL … FROM PUBLIC` and `FROM anon` | Default PUBLIC execute is removed. Anonymous callers cannot use the helper. |
| `GRANT EXECUTE … TO authenticated` | Storage uploads run as `authenticated`. No table `SELECT` on `user_roles` is granted. |
| `DROP POLICY "Admins can upload artwork media"` | Live INSERT covered three buckets with a JWT claim this app never sets. |
| `CREATE POLICY "Admins can upload artwork images"` | **Only** `bucket_id = 'artwork-images' AND current_user_is_admin()`. Live policy had no MIME/filename predicates to preserve. |
| `CREATE POLICY "Admins can upload private artwork media"` | Restores the previous JWT `WITH CHECK` for `artwork-videos` and `artwork-documents` so those buckets are not widened. |

## RPC exposure

`GRANT EXECUTE TO authenticated` means PostgREST may expose `GET /rest/v1/rpc/current_user_is_admin`. It returns only a boolean for `auth.uid()`. It cannot grant admin, accept a target user, or list `user_roles`. Leave `user_roles` without `authenticated` table privileges.

## Comparison queries (read-only)

```sql
-- Function owner, definer, search_path, arguments
SELECT
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.pronargs AS arg_count,
  p.proconfig,
  pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'current_user_is_admin';

-- Execute grants (expect authenticated = YES, PUBLIC/anon = NO)
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'current_user_is_admin';

-- authenticated must still lack table SELECT on user_roles
SELECT has_table_privilege('authenticated', 'public.user_roles', 'SELECT');

-- Storage policies
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
```

Expect after 0007:

- SELECT `Public can view artwork images` unchanged (`bucket_id = 'artwork-images'`, roles `{anon,authenticated}`).
- UPDATE `Admins can update artwork media` unchanged (JWT `app_metadata.role`).
- DELETE `Admins can delete artwork media` unchanged (JWT `app_metadata.role`) until `0008`.
- After `0008_artwork_images_admin_delete.sql`, `Admins can delete artwork images` allows DELETE on `artwork-images` only when `current_user_is_admin()` is true. Private-bucket DELETE stays on the JWT policy.

## 0008 review (not applied)

`backend/src/db/migrations/0008_artwork_images_admin_delete.sql`:

- `FOR DELETE` only; `TO authenticated` (not `anon`).
- `USING (bucket_id = 'artwork-images' AND public.current_user_is_admin())`.
- Drops/recreates only the DELETE policy named `Admins can delete artwork images`.
- Does not alter SELECT or INSERT. Does not grant anonymous delete. Does not change private-bucket JWT DELETE.
- Journal `idx` 8, tag `0008_artwork_images_admin_delete`. Snapshot id `c8a00008-…` with `prevId` `c7a00007-…` (0007).

Do not apply until explicitly approved. Storage object DELETE from the admin form needs this policy on the target database.
- SELECT `Admins can view private artwork media` unchanged (JWT + private buckets).

## Rollback

`docs/database/ART_STORAGE_ADMIN_RLS_ROLLBACK.sql`
