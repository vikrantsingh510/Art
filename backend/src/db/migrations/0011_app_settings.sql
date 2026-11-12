-- Application settings. Forward-only. Does not edit 0000–0010.
-- Key-value jsonb store for admin-configurable salon settings.
-- First row: whatsapp_enquiry. Express-only DML via maison_app.
--> statement-breakpoint
CREATE TABLE "app_settings" (
  "key" varchar(100) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings"
  ADD CONSTRAINT "app_settings_updated_by_profiles_id_fk"
  FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
REVOKE ALL ON TABLE "app_settings" FROM PUBLIC, anon, authenticated, service_role, maison_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "app_settings" TO maison_app;
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_app_settings ON "app_settings";
--> statement-breakpoint
CREATE POLICY maison_app_select_app_settings ON "app_settings" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_app_settings ON "app_settings";
--> statement-breakpoint
CREATE POLICY maison_app_insert_app_settings ON "app_settings" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_app_settings ON "app_settings";
--> statement-breakpoint
CREATE POLICY maison_app_update_app_settings ON "app_settings" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
INSERT INTO "app_settings" ("key", "value")
VALUES (
  'whatsapp_enquiry',
  '{"enabled":false,"e164":null,"buttonLabel":null}'::jsonb
)
ON CONFLICT ("key") DO NOTHING;
