-- Rollback for 0007_storage_admin_from_user_roles
-- Status: MANUAL. Do not run unless 0007 must be undone.
-- Restores the pre-0007 combined INSERT policy on storage.objects.
-- Does not change SELECT, UPDATE, or DELETE policies.
-- Does not modify user_roles rows.

BEGIN;

DROP POLICY IF EXISTS "Admins can upload artwork images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload private artwork media" ON storage.objects;

DROP POLICY IF EXISTS "Admins can upload artwork media" ON storage.objects;
CREATE POLICY "Admins can upload artwork media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  (bucket_id = ANY (ARRAY['artwork-images'::text, 'artwork-videos'::text, 'artwork-documents'::text]))
  AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
);

DROP FUNCTION IF EXISTS public.current_user_is_admin();

COMMIT;

-- After rollback, remove the 0007 journal row from drizzle.__drizzle_migrations
-- only if you also revert the git journal. Prefer leaving the journal row and
-- not re-applying 0007 until a new forward migration exists.
