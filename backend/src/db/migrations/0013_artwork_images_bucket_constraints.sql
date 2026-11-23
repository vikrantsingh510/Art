-- Express artwork-images bucket metadata reader. Forward-only. Does not edit 0000–0012.
-- Does not grant USAGE on schema storage.
-- Does not grant SELECT on storage.buckets or storage.objects to maison_app.
-- Does not change Storage RLS, bucket configuration, or existing Storage policies.
--
-- public.artwork_images_bucket_constraints() is exclusively for Express
-- getArtworkImagesUploadConstraints. It returns only id, file_size_limit,
-- and allowed_mime_types for the artwork-images row. EXECUTE is restricted
-- to maison_app. Do not GRANT EXECUTE to authenticated (PostgREST RPC).
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.artwork_images_bucket_constraints()
RETURNS TABLE (
  id text,
  file_size_limit bigint,
  allowed_mime_types text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, storage
AS $$
  SELECT
    b.id,
    b.file_size_limit,
    b.allowed_mime_types
  FROM storage.buckets AS b
  WHERE b.id = 'artwork-images'
  LIMIT 1
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.artwork_images_bucket_constraints() IS
  'Express-only artwork-images bucket reader. Returns id, file_size_limit, allowed_mime_types. Must not be used as a Storage catalog. EXECUTE granted only to maison_app.';
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.artwork_images_bucket_constraints() FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.artwork_images_bucket_constraints() TO maison_app;
