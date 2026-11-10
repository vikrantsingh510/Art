CREATE TYPE "public"."artwork_status" AS ENUM('draft', 'published', 'reserved', 'sold', 'archived');--> statement-breakpoint
CREATE TYPE "public"."media_access_level" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('video', 'certificate', 'document');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipient_name" varchar(150) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"postal_code" varchar(15) NOT NULL,
	"country" varchar(100) DEFAULT 'IN' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artwork_categories" (
	"artwork_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "artwork_categories_pk" PRIMARY KEY("artwork_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "artwork_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"alt_text" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artwork_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid NOT NULL,
	"media_type" "media_type" NOT NULL,
	"storage_bucket" varchar(100) NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text,
	"mime_type" varchar(100),
	"file_size_bytes" bigint,
	"access_level" "media_access_level" NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artwork_media_file_size_bytes_non_negative" CHECK ("artwork_media"."file_size_bytes" IS NULL OR "artwork_media"."file_size_bytes" >= 0),
	CONSTRAINT "artwork_media_private_certificates_and_documents" CHECK ("artwork_media"."media_type" NOT IN ('certificate', 'document') OR "artwork_media"."access_level" = 'private')
);
--> statement-breakpoint
CREATE TABLE "artworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"story" text,
	"technique" varchar(150),
	"medium" varchar(150),
	"material" varchar(150),
	"artist_name" varchar(150) NOT NULL,
	"year_created" integer,
	"width" numeric(10, 2),
	"height" numeric(10, 2),
	"depth" numeric(10, 2),
	"dimension_unit" varchar(10),
	"price_paise" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"inventory_quantity" integer DEFAULT 1 NOT NULL,
	"status" "artwork_status" DEFAULT 'draft' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artworks_slug_unique" UNIQUE("slug"),
	CONSTRAINT "artworks_price_paise_non_negative" CHECK ("artworks"."price_paise" >= 0),
	CONSTRAINT "artworks_inventory_quantity_non_negative" CHECK ("artworks"."inventory_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection_artworks" (
	"collection_id" uuid NOT NULL,
	"artwork_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_artworks_pk" PRIMARY KEY("collection_id","artwork_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"cover_image_path" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" varchar(150),
	"phone" varchar(20),
	"avatar_path" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_unique" UNIQUE("user_id","role")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_categories" ADD CONSTRAINT "artwork_categories_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_categories" ADD CONSTRAINT "artwork_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_images" ADD CONSTRAINT "artwork_images_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_media" ADD CONSTRAINT "artwork_media_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_artworks" ADD CONSTRAINT "collection_artworks_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_artworks" ADD CONSTRAINT "collection_artworks_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_id_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_one_default_per_user" ON "addresses" USING btree ("user_id") WHERE "addresses"."is_default" IS TRUE;--> statement-breakpoint
CREATE INDEX "artwork_images_artwork_id_idx" ON "artwork_images" USING btree ("artwork_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artwork_images_one_primary_per_artwork" ON "artwork_images" USING btree ("artwork_id") WHERE "artwork_images"."is_primary" IS TRUE;--> statement-breakpoint
CREATE INDEX "artwork_media_artwork_id_idx" ON "artwork_media" USING btree ("artwork_id");--> statement-breakpoint
CREATE INDEX "artworks_status_idx" ON "artworks" USING btree ("status");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_auth_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;