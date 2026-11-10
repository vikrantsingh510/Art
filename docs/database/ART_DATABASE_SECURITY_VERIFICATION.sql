-- Art Marketplace — read-only security verification
-- Run in the Supabase SQL Editor after 0000–0005 are applied.
-- Do not put passwords, keys, or connection strings in this file or in the output you share.

-- 1. Role attributes
SELECT
  rolname,
  rolcanlogin,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolreplication,
  rolinherit,
  rolbypassrls
FROM pg_roles
WHERE rolname IN (
  'maison_app',
  'anon',
  'authenticated',
  'postgres',
  'service_role',
  'supabase_admin'
)
ORDER BY rolname;

-- 2. maison_app must not be a member of privileged roles
SELECT
  member.rolname AS member,
  role.rolname AS granted_role
FROM pg_auth_members auth_members
JOIN pg_roles member ON member.oid = auth_members.member
JOIN pg_roles role ON role.oid = auth_members.roleid
WHERE member.rolname = 'maison_app'
   OR role.rolname = 'maison_app';

-- 3. Table ownership of the 22 application tables
SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  pg_catalog.pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'addresses',
    'artwork_categories',
    'artwork_images',
    'artwork_media',
    'artwork_previews',
    'artworks',
    'audit_logs',
    'categories',
    'collection_artworks',
    'collections',
    'inventory_reservations',
    'notification_outbox',
    'order_items',
    'orders',
    'payments',
    'profiles',
    'refunds',
    'shipments',
    'user_roles',
    'webhook_events',
    'wishlist_items',
    'wishlists'
  )
ORDER BY c.relname;

-- 4. Table grants for application tables
SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'addresses',
    'artwork_categories',
    'artwork_images',
    'artwork_media',
    'artwork_previews',
    'artworks',
    'audit_logs',
    'categories',
    'collection_artworks',
    'collections',
    'inventory_reservations',
    'notification_outbox',
    'order_items',
    'orders',
    'payments',
    'profiles',
    'refunds',
    'shipments',
    'user_roles',
    'webhook_events',
    'wishlist_items',
    'wishlists'
  )
  AND grantee IN (
    'PUBLIC',
    'anon',
    'authenticated',
    'service_role',
    'maison_app',
    'postgres'
  )
ORDER BY table_name, grantee, privilege_type;

-- 5. Client DML that must be empty after hardening
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'addresses',
    'artwork_categories',
    'artwork_images',
    'artwork_media',
    'artwork_previews',
    'artworks',
    'audit_logs',
    'categories',
    'collection_artworks',
    'collections',
    'inventory_reservations',
    'notification_outbox',
    'order_items',
    'orders',
    'payments',
    'profiles',
    'refunds',
    'shipments',
    'user_roles',
    'webhook_events',
    'wishlist_items',
    'wishlists'
  )
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
  AND privilege_type IN (
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER',
    'MAINTAIN'
  )
ORDER BY table_name, grantee, privilege_type;

-- 6. Schema grants (USAGE for anon/authenticated may remain; that is expected)
SELECT
  nspname AS schema_name,
  pg_catalog.array_to_string(nspacl, ',') AS raw_acl
FROM pg_namespace
WHERE nspname = 'public';

-- 7. RLS enabled state (FORCE should remain false)
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'addresses',
    'artwork_categories',
    'artwork_images',
    'artwork_media',
    'artwork_previews',
    'artworks',
    'audit_logs',
    'categories',
    'collection_artworks',
    'collections',
    'inventory_reservations',
    'notification_outbox',
    'order_items',
    'orders',
    'payments',
    'profiles',
    'refunds',
    'shipments',
    'user_roles',
    'webhook_events',
    'wishlist_items',
    'wishlists'
  )
ORDER BY c.relname;

-- 8. RLS policies (roles should be maison_app only)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'addresses',
    'artwork_categories',
    'artwork_images',
    'artwork_media',
    'artwork_previews',
    'artworks',
    'audit_logs',
    'categories',
    'collection_artworks',
    'collections',
    'inventory_reservations',
    'notification_outbox',
    'order_items',
    'orders',
    'payments',
    'profiles',
    'refunds',
    'shipments',
    'user_roles',
    'webhook_events',
    'wishlist_items',
    'wishlists'
  )
ORDER BY tablename, cmd, policyname;

-- 9. Default privileges for the current user and for postgres / supabase_admin
SELECT
  pg_catalog.pg_get_userbyid(defaclrole) AS owner_role,
  n.nspname AS schema_name,
  CASE defaclobjtype
    WHEN 'r' THEN 'table'
    WHEN 'S' THEN 'sequence'
    WHEN 'f' THEN 'function'
    WHEN 'T' THEN 'type'
    WHEN 'n' THEN 'schema'
    ELSE defaclobjtype::text
  END AS object_type,
  pg_catalog.array_to_string(defaclacl, ',') AS raw_acl
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public'
   OR n.nspname IS NULL
ORDER BY owner_role, object_type;

-- 10. audit_logs privileges
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
ORDER BY grantee, privilege_type;

-- 11. audit_logs triggers
SELECT
  tgname AS trigger_name,
  tgfoid::regprocedure AS function_signature,
  CASE
    WHEN tgtype & 4 = 4 THEN 'UPDATE'
    WHEN tgtype & 8 = 8 THEN 'DELETE'
    WHEN tgtype & 16 = 16 THEN 'INSERT'
    ELSE tgtype::text
  END AS event
FROM pg_trigger
WHERE tgrelid = 'public.audit_logs'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- 12. user_roles privileges (maison_app should be SELECT only)
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_roles'
ORDER BY grantee, privilege_type;

-- 13. Auth FK existence and ON DELETE action
-- confdeltype: a=no action, r=restrict, c=cascade, n=set null, d=set default
SELECT
  conname,
  conrelid::regclass AS from_table,
  confrelid::regclass AS to_table,
  pg_get_constraintdef(oid) AS definition,
  confdeltype
FROM pg_constraint
WHERE conname = 'profiles_id_auth_users_id_fk';
