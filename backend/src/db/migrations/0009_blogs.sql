-- Journal / blogs. Forward-only. Does not edit 0000–0008.
-- Does not alter artworks or collections. Express-only DML via maison_app.
--> statement-breakpoint
CREATE TYPE "public"."blog_status" AS ENUM('draft', 'published');
--> statement-breakpoint
GRANT USAGE ON TYPE "public"."blog_status" TO maison_app;
--> statement-breakpoint
CREATE TABLE "blogs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "excerpt" text,
  "body" text DEFAULT '' NOT NULL,
  "cover_image_path" text,
  "cover_alt_text" text,
  "seo_title" varchar(255),
  "seo_description" varchar(320),
  "status" "blog_status" DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "blogs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blog_artworks" (
  "blog_id" uuid NOT NULL,
  "artwork_id" uuid NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "blog_artworks_pk" PRIMARY KEY("blog_id","artwork_id")
);
--> statement-breakpoint
ALTER TABLE "blog_artworks"
  ADD CONSTRAINT "blog_artworks_blog_id_blogs_id_fk"
  FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_artworks"
  ADD CONSTRAINT "blog_artworks_artwork_id_artworks_id_fk"
  FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "blogs_status_idx" ON "blogs" ("status");
--> statement-breakpoint
CREATE INDEX "blogs_status_published_at_idx" ON "blogs" ("status","published_at");
--> statement-breakpoint
REVOKE ALL ON TABLE "blogs", "blog_artworks" FROM PUBLIC, anon, authenticated, service_role, maison_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blogs", "blog_artworks" TO maison_app;
--> statement-breakpoint
ALTER TABLE "blogs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "blog_artworks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_blogs ON "blogs";
--> statement-breakpoint
CREATE POLICY maison_app_select_blogs ON "blogs" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_blogs ON "blogs";
--> statement-breakpoint
CREATE POLICY maison_app_insert_blogs ON "blogs" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_blogs ON "blogs";
--> statement-breakpoint
CREATE POLICY maison_app_update_blogs ON "blogs" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_blogs ON "blogs";
--> statement-breakpoint
CREATE POLICY maison_app_delete_blogs ON "blogs" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_blog_artworks ON "blog_artworks";
--> statement-breakpoint
CREATE POLICY maison_app_select_blog_artworks ON "blog_artworks" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_blog_artworks ON "blog_artworks";
--> statement-breakpoint
CREATE POLICY maison_app_insert_blog_artworks ON "blog_artworks" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_blog_artworks ON "blog_artworks";
--> statement-breakpoint
CREATE POLICY maison_app_update_blog_artworks ON "blog_artworks" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_blog_artworks ON "blog_artworks";
--> statement-breakpoint
CREATE POLICY maison_app_delete_blog_artworks ON "blog_artworks" FOR DELETE TO maison_app USING (true);
