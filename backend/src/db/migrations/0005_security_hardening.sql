-- Custom SQL: application security hardening. Hand-owned like the Auth FK in 0000.
-- Does not create or alter auth.users. Does not grant maison_app to privileged roles.
-- maison_app is NOLOGIN until a manual SQL Editor step sets LOGIN and a password.

-- 22 application tables only. Do not revoke from unrelated public-schema objects.
-- addresses, artwork_categories, artwork_images, artwork_media, artwork_previews,
-- artworks, audit_logs, categories, collection_artworks, collections,
-- inventory_reservations, notification_outbox, order_items, orders, payments,
-- profiles, refunds, shipments, user_roles, webhook_events, wishlist_items, wishlists
--> statement-breakpoint
DO $$
DECLARE
  existing_super boolean;
  existing_createdb boolean;
  existing_createrole boolean;
  existing_replication boolean;
  existing_inherit boolean;
  existing_bypassrls boolean;
  existing_canlogin boolean;
  violations text[] := ARRAY[]::text[];
  granted_roles text[];
BEGIN
  SELECT
    rolsuper,
    rolcreatedb,
    rolcreaterole,
    rolreplication,
    rolinherit,
    rolbypassrls,
    rolcanlogin
  INTO
    existing_super,
    existing_createdb,
    existing_createrole,
    existing_replication,
    existing_inherit,
    existing_bypassrls,
    existing_canlogin
  FROM pg_catalog.pg_roles
  WHERE rolname = 'maison_app';

  IF NOT FOUND THEN
    CREATE ROLE maison_app
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOINHERIT
      NOBYPASSRLS;
  ELSE
    IF existing_super THEN
      violations := violations || 'NOSUPERUSER';
    END IF;
    IF existing_createdb THEN
      violations := violations || 'NOCREATEDB';
    END IF;
    IF existing_createrole THEN
      violations := violations || 'NOCREATEROLE';
    END IF;
    IF existing_replication THEN
      violations := violations || 'NOREPLICATION';
    END IF;
    IF existing_inherit THEN
      violations := violations || 'NOINHERIT';
    END IF;
    IF existing_bypassrls THEN
      violations := violations || 'NOBYPASSRLS';
    END IF;
    IF existing_canlogin THEN
      violations := violations || 'NOLOGIN';
    END IF;

    IF cardinality(violations) > 0 THEN
      RAISE EXCEPTION
        'Existing role maison_app has incorrect attributes (%). Expected NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOINHERIT, NOBYPASSRLS, NOLOGIN. Refusing to ALTER ROLE; resolve the role manually and retry.',
        array_to_string(violations, ', ');
    END IF;
  END IF;

  SELECT array_agg(role.rolname ORDER BY role.rolname)
  INTO granted_roles
  FROM pg_catalog.pg_auth_members auth_members
  JOIN pg_catalog.pg_roles member ON member.oid = auth_members.member
  JOIN pg_catalog.pg_roles role ON role.oid = auth_members.roleid
  WHERE member.rolname = 'maison_app';

  IF granted_roles IS NOT NULL THEN
    RAISE EXCEPTION
      'Role maison_app is a member of other role(s) (%). Refusing to REVOKE memberships or ALTER ROLE; resolve memberships manually and retry.',
      array_to_string(granted_roles, ', ');
  END IF;
END
$$;
--> statement-breakpoint
COMMENT ON ROLE maison_app IS
  'Express runtime role for Maison d''Art business tables. NOLOGIN until operators set LOGIN and a password outside migrations. Must not be a member of postgres, service_role, or supabase_admin.';
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO maison_app', current_database());
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO maison_app;
--> statement-breakpoint
GRANT USAGE ON TYPE
  "public"."artwork_status",
  "public"."media_access_level",
  "public"."media_type",
  "public"."notification_status",
  "public"."order_status",
  "public"."payment_status",
  "public"."refund_status",
  "public"."reservation_status",
  "public"."shipment_status",
  "public"."user_role",
  "public"."webhook_processing_status"
TO maison_app;
--> statement-breakpoint
REVOKE ALL ON TABLE
  "addresses",
  "artwork_categories",
  "artwork_images",
  "artwork_media",
  "artwork_previews",
  "artworks",
  "audit_logs",
  "categories",
  "collection_artworks",
  "collections",
  "inventory_reservations",
  "notification_outbox",
  "order_items",
  "orders",
  "payments",
  "profiles",
  "refunds",
  "shipments",
  "user_roles",
  "webhook_events",
  "wishlist_items",
  "wishlists"
FROM PUBLIC, anon, authenticated, service_role, maison_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "profiles" TO maison_app;
--> statement-breakpoint
GRANT SELECT ON TABLE "user_roles" TO maison_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "addresses",
  "artworks",
  "categories",
  "artwork_categories",
  "collections",
  "collection_artworks",
  "artwork_images",
  "artwork_media",
  "wishlists",
  "wishlist_items",
  "artwork_previews"
TO maison_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE
  "orders",
  "order_items",
  "inventory_reservations",
  "payments",
  "refunds",
  "shipments",
  "webhook_events",
  "notification_outbox"
TO maison_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "audit_logs" TO maison_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "artwork_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "artwork_images" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "artwork_media" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "artwork_previews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "artworks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collection_artworks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inventory_reservations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notification_outbox" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shipments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "wishlist_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "wishlists" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_profiles ON "profiles";
--> statement-breakpoint
CREATE POLICY maison_app_select_profiles ON "profiles" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_profiles ON "profiles";
--> statement-breakpoint
CREATE POLICY maison_app_insert_profiles ON "profiles" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_profiles ON "profiles";
--> statement-breakpoint
CREATE POLICY maison_app_update_profiles ON "profiles" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_user_roles ON "user_roles";
--> statement-breakpoint
CREATE POLICY maison_app_select_user_roles ON "user_roles" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_addresses ON "addresses";
--> statement-breakpoint
CREATE POLICY maison_app_select_addresses ON "addresses" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_addresses ON "addresses";
--> statement-breakpoint
CREATE POLICY maison_app_insert_addresses ON "addresses" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_addresses ON "addresses";
--> statement-breakpoint
CREATE POLICY maison_app_update_addresses ON "addresses" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_addresses ON "addresses";
--> statement-breakpoint
CREATE POLICY maison_app_delete_addresses ON "addresses" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_artworks ON "artworks";
--> statement-breakpoint
CREATE POLICY maison_app_select_artworks ON "artworks" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_artworks ON "artworks";
--> statement-breakpoint
CREATE POLICY maison_app_insert_artworks ON "artworks" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_artworks ON "artworks";
--> statement-breakpoint
CREATE POLICY maison_app_update_artworks ON "artworks" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_artworks ON "artworks";
--> statement-breakpoint
CREATE POLICY maison_app_delete_artworks ON "artworks" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_categories ON "categories";
--> statement-breakpoint
CREATE POLICY maison_app_select_categories ON "categories" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_categories ON "categories";
--> statement-breakpoint
CREATE POLICY maison_app_insert_categories ON "categories" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_categories ON "categories";
--> statement-breakpoint
CREATE POLICY maison_app_update_categories ON "categories" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_categories ON "categories";
--> statement-breakpoint
CREATE POLICY maison_app_delete_categories ON "categories" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_artwork_categories ON "artwork_categories";
--> statement-breakpoint
CREATE POLICY maison_app_select_artwork_categories ON "artwork_categories" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_artwork_categories ON "artwork_categories";
--> statement-breakpoint
CREATE POLICY maison_app_insert_artwork_categories ON "artwork_categories" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_artwork_categories ON "artwork_categories";
--> statement-breakpoint
CREATE POLICY maison_app_update_artwork_categories ON "artwork_categories" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_artwork_categories ON "artwork_categories";
--> statement-breakpoint
CREATE POLICY maison_app_delete_artwork_categories ON "artwork_categories" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_collections ON "collections";
--> statement-breakpoint
CREATE POLICY maison_app_select_collections ON "collections" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_collections ON "collections";
--> statement-breakpoint
CREATE POLICY maison_app_insert_collections ON "collections" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_collections ON "collections";
--> statement-breakpoint
CREATE POLICY maison_app_update_collections ON "collections" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_collections ON "collections";
--> statement-breakpoint
CREATE POLICY maison_app_delete_collections ON "collections" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_collection_artworks ON "collection_artworks";
--> statement-breakpoint
CREATE POLICY maison_app_select_collection_artworks ON "collection_artworks" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_collection_artworks ON "collection_artworks";
--> statement-breakpoint
CREATE POLICY maison_app_insert_collection_artworks ON "collection_artworks" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_collection_artworks ON "collection_artworks";
--> statement-breakpoint
CREATE POLICY maison_app_update_collection_artworks ON "collection_artworks" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_collection_artworks ON "collection_artworks";
--> statement-breakpoint
CREATE POLICY maison_app_delete_collection_artworks ON "collection_artworks" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_artwork_images ON "artwork_images";
--> statement-breakpoint
CREATE POLICY maison_app_select_artwork_images ON "artwork_images" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_artwork_images ON "artwork_images";
--> statement-breakpoint
CREATE POLICY maison_app_insert_artwork_images ON "artwork_images" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_artwork_images ON "artwork_images";
--> statement-breakpoint
CREATE POLICY maison_app_update_artwork_images ON "artwork_images" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_artwork_images ON "artwork_images";
--> statement-breakpoint
CREATE POLICY maison_app_delete_artwork_images ON "artwork_images" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_artwork_media ON "artwork_media";
--> statement-breakpoint
CREATE POLICY maison_app_select_artwork_media ON "artwork_media" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_artwork_media ON "artwork_media";
--> statement-breakpoint
CREATE POLICY maison_app_insert_artwork_media ON "artwork_media" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_artwork_media ON "artwork_media";
--> statement-breakpoint
CREATE POLICY maison_app_update_artwork_media ON "artwork_media" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_artwork_media ON "artwork_media";
--> statement-breakpoint
CREATE POLICY maison_app_delete_artwork_media ON "artwork_media" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_wishlists ON "wishlists";
--> statement-breakpoint
CREATE POLICY maison_app_select_wishlists ON "wishlists" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_wishlists ON "wishlists";
--> statement-breakpoint
CREATE POLICY maison_app_insert_wishlists ON "wishlists" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_wishlists ON "wishlists";
--> statement-breakpoint
CREATE POLICY maison_app_update_wishlists ON "wishlists" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_wishlists ON "wishlists";
--> statement-breakpoint
CREATE POLICY maison_app_delete_wishlists ON "wishlists" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_wishlist_items ON "wishlist_items";
--> statement-breakpoint
CREATE POLICY maison_app_select_wishlist_items ON "wishlist_items" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_wishlist_items ON "wishlist_items";
--> statement-breakpoint
CREATE POLICY maison_app_insert_wishlist_items ON "wishlist_items" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_wishlist_items ON "wishlist_items";
--> statement-breakpoint
CREATE POLICY maison_app_update_wishlist_items ON "wishlist_items" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_wishlist_items ON "wishlist_items";
--> statement-breakpoint
CREATE POLICY maison_app_delete_wishlist_items ON "wishlist_items" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_artwork_previews ON "artwork_previews";
--> statement-breakpoint
CREATE POLICY maison_app_select_artwork_previews ON "artwork_previews" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_artwork_previews ON "artwork_previews";
--> statement-breakpoint
CREATE POLICY maison_app_insert_artwork_previews ON "artwork_previews" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_artwork_previews ON "artwork_previews";
--> statement-breakpoint
CREATE POLICY maison_app_update_artwork_previews ON "artwork_previews" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_delete_artwork_previews ON "artwork_previews";
--> statement-breakpoint
CREATE POLICY maison_app_delete_artwork_previews ON "artwork_previews" FOR DELETE TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_orders ON "orders";
--> statement-breakpoint
CREATE POLICY maison_app_select_orders ON "orders" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_orders ON "orders";
--> statement-breakpoint
CREATE POLICY maison_app_insert_orders ON "orders" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_orders ON "orders";
--> statement-breakpoint
CREATE POLICY maison_app_update_orders ON "orders" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_order_items ON "order_items";
--> statement-breakpoint
CREATE POLICY maison_app_select_order_items ON "order_items" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_order_items ON "order_items";
--> statement-breakpoint
CREATE POLICY maison_app_insert_order_items ON "order_items" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_order_items ON "order_items";
--> statement-breakpoint
CREATE POLICY maison_app_update_order_items ON "order_items" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_inventory_reservations ON "inventory_reservations";
--> statement-breakpoint
CREATE POLICY maison_app_select_inventory_reservations ON "inventory_reservations" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_inventory_reservations ON "inventory_reservations";
--> statement-breakpoint
CREATE POLICY maison_app_insert_inventory_reservations ON "inventory_reservations" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_inventory_reservations ON "inventory_reservations";
--> statement-breakpoint
CREATE POLICY maison_app_update_inventory_reservations ON "inventory_reservations" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_payments ON "payments";
--> statement-breakpoint
CREATE POLICY maison_app_select_payments ON "payments" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_payments ON "payments";
--> statement-breakpoint
CREATE POLICY maison_app_insert_payments ON "payments" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_payments ON "payments";
--> statement-breakpoint
CREATE POLICY maison_app_update_payments ON "payments" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_refunds ON "refunds";
--> statement-breakpoint
CREATE POLICY maison_app_select_refunds ON "refunds" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_refunds ON "refunds";
--> statement-breakpoint
CREATE POLICY maison_app_insert_refunds ON "refunds" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_refunds ON "refunds";
--> statement-breakpoint
CREATE POLICY maison_app_update_refunds ON "refunds" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_shipments ON "shipments";
--> statement-breakpoint
CREATE POLICY maison_app_select_shipments ON "shipments" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_shipments ON "shipments";
--> statement-breakpoint
CREATE POLICY maison_app_insert_shipments ON "shipments" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_shipments ON "shipments";
--> statement-breakpoint
CREATE POLICY maison_app_update_shipments ON "shipments" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_webhook_events ON "webhook_events";
--> statement-breakpoint
CREATE POLICY maison_app_select_webhook_events ON "webhook_events" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_webhook_events ON "webhook_events";
--> statement-breakpoint
CREATE POLICY maison_app_insert_webhook_events ON "webhook_events" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_webhook_events ON "webhook_events";
--> statement-breakpoint
CREATE POLICY maison_app_update_webhook_events ON "webhook_events" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_notification_outbox ON "notification_outbox";
--> statement-breakpoint
CREATE POLICY maison_app_select_notification_outbox ON "notification_outbox" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_notification_outbox ON "notification_outbox";
--> statement-breakpoint
CREATE POLICY maison_app_insert_notification_outbox ON "notification_outbox" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_update_notification_outbox ON "notification_outbox";
--> statement-breakpoint
CREATE POLICY maison_app_update_notification_outbox ON "notification_outbox" FOR UPDATE TO maison_app USING (true) WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_select_audit_logs ON "audit_logs";
--> statement-breakpoint
CREATE POLICY maison_app_select_audit_logs ON "audit_logs" FOR SELECT TO maison_app USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS maison_app_insert_audit_logs ON "audit_logs";
--> statement-breakpoint
CREATE POLICY maison_app_insert_audit_logs ON "audit_logs" FOR INSERT TO maison_app WITH CHECK (true);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."prevent_audit_logs_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
COMMENT ON FUNCTION "public"."prevent_audit_logs_mutation"() IS
  'Rejects UPDATE and DELETE on audit_logs. Does not block INSERT. Superusers and trigger-disable remain out of scope.';
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_logs_prevent_update ON "audit_logs";
--> statement-breakpoint
CREATE TRIGGER audit_logs_prevent_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."prevent_audit_logs_mutation"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON "audit_logs";
--> statement-breakpoint
CREATE TRIGGER audit_logs_prevent_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."prevent_audit_logs_mutation"();
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."prevent_audit_logs_mutation"() FROM PUBLIC, anon, authenticated, service_role, maison_app;
