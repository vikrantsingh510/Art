-- Admin DELETE on public gallery images uses public.user_roles via
-- current_user_is_admin(), matching 0007 INSERT. Forward-only.
-- Does not edit 0000–0007. Does not change JWT policies on private buckets.
-- Does not grant anonymous delete. Does not alter SELECT or UPDATE.
--> statement-breakpoint
DROP POLICY IF EXISTS "Admins can delete artwork images" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "Admins can delete artwork images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'artwork-images'
  AND public.current_user_is_admin()
);
