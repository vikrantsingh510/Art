-- Feature expansion: unique phone, dimension checks, carts separate from wishlists,
-- orders.placed_at index, maison_app grants/RLS for carts.
-- Forward-only. Does not edit 0000–0005. Does not reset or truncate business data
-- except moving current wishlist_items into cart_items (those rows were the cart).
--> statement-breakpoint
UPDATE "profiles" SET "phone" = NULL WHERE btrim(coalesce("phone", '')) = '';
--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    "phone",
    ROW_NUMBER() OVER (PARTITION BY "phone" ORDER BY "created_at", "id") AS rn
  FROM "profiles"
  WHERE "phone" IS NOT NULL
)
UPDATE "profiles" AS p
SET "phone" = NULL
FROM ranked
WHERE p."id" = ranked."id" AND ranked.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_phone_unique" ON "profiles" ("phone") WHERE "phone" IS NOT NULL;
--> statement-breakpoint
UPDATE "artworks"
SET "dimension_unit" = lower(btrim("dimension_unit"))
WHERE "dimension_unit" IS NOT NULL;
--> statement-breakpoint
UPDATE "artworks" SET "dimension_unit" = 'in' WHERE "dimension_unit" IN ('inch', 'inches', '"');
--> statement-breakpoint
UPDATE "artworks" SET "dimension_unit" = 'cm' WHERE "dimension_unit" IN ('centimeter', 'centimetre', 'centimeters', 'centimetres', 'cms');
--> statement-breakpoint
UPDATE "artworks" SET "dimension_unit" = 'mm' WHERE "dimension_unit" IN ('millimeter', 'millimetre', 'millimeters', 'millimetres');
--> statement-breakpoint
UPDATE "artworks" SET "dimension_unit" = NULL
WHERE "dimension_unit" IS NOT NULL AND "dimension_unit" NOT IN ('cm', 'in', 'mm');
--> statement-breakpoint
UPDATE "artworks" SET "width" = NULL WHERE "width" IS NOT NULL AND "width" <= 0;
--> statement-breakpoint
UPDATE "artworks" SET "height" = NULL WHERE "height" IS NOT NULL AND "height" <= 0;
--> statement-breakpoint
UPDATE "artworks" SET "depth" = NULL WHERE "depth" IS NOT NULL AND "depth" <= 0;
--> statement-breakpoint
ALTER TABLE "artworks" DROP CONSTRAINT IF EXISTS "artworks_dimension_unit_allowed";
--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_dimension_unit_allowed"
  CHECK ("dimension_unit" IS NULL OR "dimension_unit" IN ('cm', 'in', 'mm'));
--> statement-breakpoint
ALTER TABLE "artworks" DROP CONSTRAINT IF EXISTS "artworks_width_positive";
--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_width_positive"
  CHECK ("width" IS NULL OR "width" > 0);
--> statement-breakpoint
ALTER TABLE "artworks" DROP CONSTRAINT IF EXISTS "artworks_height_positive";
--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_height_positive"
  CHECK ("height" IS NULL OR "height" > 0);
--> statement-breakpoint
ALTER TABLE "artworks" DROP CONSTRAINT IF EXISTS "artworks_depth_positive";
--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_depth_positive"
  CHECK ("depth" IS NULL OR "depth" > 0);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_placed_at_idx" ON "orders" ("placed_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "carts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "carts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cart_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cart_id" uuid NOT NULL,
  "artwork_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'carts_user_id_profiles_id_fk'
  ) THEN
    ALTER TABLE "carts"
      ADD CONSTRAINT "carts_user_id_profiles_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_cart_id_carts_id_fk'
  ) THEN
    ALTER TABLE "cart_items"
      ADD CONSTRAINT "cart_items_cart_id_carts_id_fk"
      FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_artwork_id_artworks_id_fk'
  ) THEN
    ALTER TABLE "cart_items"
      ADD CONSTRAINT "cart_items_artwork_id_artworks_id_fk"
      FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_cart_id_artwork_id_unique'
  ) THEN
    ALTER TABLE "cart_items"
      ADD CONSTRAINT "cart_items_cart_id_artwork_id_unique" UNIQUE("cart_id", "artwork_id");
  END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_items_artwork_id_idx" ON "cart_items" ("artwork_id");
--> statement-breakpoint
INSERT INTO "carts" ("user_id")
SELECT "user_id" FROM "wishlists"
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "carts" ("user_id")
SELECT "id" FROM "profiles"
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "cart_items" ("cart_id", "artwork_id", "created_at")
SELECT c."id", wi."artwork_id", wi."created_at"
FROM "wishlist_items" wi
JOIN "wishlists" w ON w."id" = wi."wishlist_id"
JOIN "carts" c ON c."user_id" = w."user_id"
ON CONFLICT ("cart_id", "artwork_id") DO NOTHING;
--> statement-breakpoint
DELETE FROM "wishlist_items";
--> statement-breakpoint
REVOKE ALL ON TABLE "carts", "cart_items" FROM PUBLIC, anon, authenticated, service_role, maison_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "carts", "cart_items" TO maison_app;
--> statement-breakpoint
ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_carts ON "carts";
--> statement-breakpoint
CREATE POLICY maison_app_select_carts ON "carts" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_carts ON "carts";
--> statement-breakpoint
CREATE POLICY maison_app_insert_carts ON "carts" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_carts ON "carts";
--> statement-breakpoint
CREATE POLICY maison_app_update_carts ON "carts" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_carts ON "carts";
--> statement-breakpoint
CREATE POLICY maison_app_delete_carts ON "carts" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_cart_items ON "cart_items";
--> statement-breakpoint
CREATE POLICY maison_app_select_cart_items ON "cart_items" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_cart_items ON "cart_items";
--> statement-breakpoint
CREATE POLICY maison_app_insert_cart_items ON "cart_items" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_cart_items ON "cart_items";
--> statement-breakpoint
CREATE POLICY maison_app_update_cart_items ON "cart_items" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_cart_items ON "cart_items";
--> statement-breakpoint
CREATE POLICY maison_app_delete_cart_items ON "cart_items" FOR DELETE TO maison_app USING (true);
