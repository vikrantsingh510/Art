-- Artists section. Forward-only. Does not edit 0000–0009.
-- Adds artists and nullable artworks.artist_id (ON DELETE SET NULL).
-- Retains artworks.artist_name. Express-only DML via maison_app.
--> statement-breakpoint
CREATE TYPE "public"."artist_status" AS ENUM('draft', 'published');
--> statement-breakpoint
GRANT USAGE ON TYPE "public"."artist_status" TO maison_app;
--> statement-breakpoint
CREATE TABLE "artists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(150) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "short_bio" text,
  "biography" text,
  "profile_image_path" text,
  "profile_image_alt" text,
  "artistic_style" varchar(150),
  "medium" varchar(150),
  "location" varchar(150),
  "seo_title" varchar(255),
  "seo_description" varchar(320),
  "status" "artist_status" DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "artists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "artworks"
  ADD COLUMN "artist_id" uuid;
--> statement-breakpoint
ALTER TABLE "artworks"
  ADD CONSTRAINT "artworks_artist_id_artists_id_fk"
  FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "artists_status_idx" ON "artists" ("status");
--> statement-breakpoint
CREATE INDEX "artists_status_published_at_idx" ON "artists" ("status","published_at");
--> statement-breakpoint
CREATE INDEX "artists_name_idx" ON "artists" ("name");
--> statement-breakpoint
CREATE INDEX "artworks_artist_id_idx" ON "artworks" ("artist_id");
--> statement-breakpoint
REVOKE ALL ON TABLE "artists" FROM PUBLIC, anon, authenticated, service_role, maison_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "artists" TO maison_app;
--> statement-breakpoint
ALTER TABLE "artists" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_artists ON "artists";
--> statement-breakpoint
CREATE POLICY maison_app_select_artists ON "artists" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_artists ON "artists";
--> statement-breakpoint
CREATE POLICY maison_app_insert_artists ON "artists" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_artists ON "artists";
--> statement-breakpoint
CREATE POLICY maison_app_update_artists ON "artists" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_artists ON "artists";
--> statement-breakpoint
CREATE POLICY maison_app_delete_artists ON "artists" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
-- Backfill: one artist per unambiguous exact artist_name. Normalized collisions
-- (case/whitespace) are left unlinked. No biographies or portraits are invented.
WITH norms AS (
  SELECT
    artist_name,
    lower(regexp_replace(trim(artist_name), '\s+', ' ', 'g')) AS norm
  FROM artworks
  WHERE artist_name IS NOT NULL AND btrim(artist_name) <> ''
  GROUP BY artist_name
),
ambiguous_norms AS (
  SELECT norm
  FROM norms
  GROUP BY norm
  HAVING count(*) > 1
),
unambiguous AS (
  SELECT n.artist_name
  FROM norms n
  WHERE n.norm NOT IN (SELECT a.norm FROM ambiguous_norms a)
)
INSERT INTO artists (name, slug, status, published_at)
SELECT
  u.artist_name,
  COALESCE(
    NULLIF(
      trim(both '-' from lower(regexp_replace(u.artist_name, '[^a-zA-Z0-9]+', '-', 'g'))),
      ''
    ),
    'artist'
  ),
  CASE
    WHEN EXISTS (
      SELECT 1 FROM artworks a
      WHERE a.artist_name = u.artist_name AND a.status = 'published'
    ) THEN 'published'::artist_status
    ELSE 'draft'::artist_status
  END,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM artworks a
      WHERE a.artist_name = u.artist_name AND a.status = 'published'
    ) THEN now()
    ELSE NULL
  END
FROM unambiguous u
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE artworks a
SET artist_id = ar.id
FROM artists ar
WHERE a.artist_id IS NULL
  AND a.artist_name = ar.name;
