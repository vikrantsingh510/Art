-- Storage INSERT for public gallery images now trusts public.user_roles,
-- matching Express requireAdmin. Forward-only. Does not edit 0000–0006.
-- Does not change user_roles grants or rows. Does not write Auth JWT claims.
-- Does not alter SELECT, UPDATE, or DELETE policies on storage.objects.
--
-- Live INSERT "Admins can upload artwork media" covered three buckets with
-- only: bucket_id IN (artwork-images, artwork-videos, artwork-documents)
-- AND jwt app_metadata.role = admin. No MIME or filename predicates.
-- That combined policy is split: artwork-images uses user_roles; the two
-- private buckets keep the previous JWT WITH CHECK unchanged.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.current_user_is_admin() IS
  'True when auth.uid() has public.user_roles.role = admin. No arguments. SECURITY DEFINER for Storage RLS; does not grant privileges.';
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can upload artwork media" ON storage.objects;
--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can upload artwork images" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "Admins can upload artwork images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'artwork-images'
  AND public.current_user_is_admin()
);
--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can upload private artwork media" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "Admins can upload private artwork media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  (bucket_id = ANY (ARRAY['artwork-videos'::text, 'artwork-documents'::text]))
  AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
);
