-- Express customer-role provisioning. Forward-only. Does not edit 0000–0011.
-- Does not add table INSERT, UPDATE, or DELETE privileges on user_roles.
-- Does not change 0005 RLS policies or table grants.
-- Does not enable maison_app LOGIN.
--
-- public.provision_customer_role(uuid) is exclusively for Express first-login
-- provisioning (provisionCustomerIdentity). It can insert only the customer
-- role. It must not be used for admin role assignment. EXECUTE is restricted
-- to maison_app. Do not GRANT EXECUTE to authenticated (PostgREST RPC).
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.provision_customer_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'provision_customer_role requires a profile UUID'
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
  ) THEN
    RAISE EXCEPTION 'provision_customer_role: profile % does not exist', p_user_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.provision_customer_role(uuid) IS
  'Express-only first-login helper. Inserts only the customer role for an existing profile. Must not be used for admin assignment. EXECUTE granted only to maison_app.';
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.provision_customer_role(uuid) FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.provision_customer_role(uuid) TO maison_app;
