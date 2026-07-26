CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON public.user_roles TO authenticated;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'
FROM public.profiles p
WHERE lower(p.email) IN ('sarel190@gmail.com', 'razoakii17@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_users()
RETURNS TABLE (
  account_id uuid,
  user_id uuid,
  email text,
  full_name text,
  account_name text,
  account_status text,
  member_role text,
  joined_at timestamptz,
  subscription_id uuid,
  plan_id text,
  subscription_status text,
  subscription_provider text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  included_pools int,
  extra_pools int,
  total_pool_limit int,
  pools_active_count int,
  included_scans int,
  extra_scan_packs int,
  total_scan_limit int,
  scans_used int,
  scans_billable int,
  scans_remaining int,
  tests_count int,
  last_scan_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  FOR v_account_id IN SELECT a.id FROM public.accounts a LOOP
    PERFORM public.refresh_usage_period(v_account_id);
  END LOOP;

  RETURN QUERY
  WITH primary_member AS (
    SELECT DISTINCT ON (am.account_id)
      am.account_id,
      am.user_id,
      am.role,
      am.created_at
    FROM public.account_members am
    ORDER BY
      am.account_id,
      CASE WHEN am.role = 'owner' THEN 0 ELSE 1 END,
      am.created_at ASC
  ),
  latest_subscription AS (
    SELECT DISTINCT ON (s.account_id)
      s.*
    FROM public.subscriptions s
    ORDER BY
      s.account_id,
      CASE
        WHEN s.status IN ('active', 'trialing', 'past_due')
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
          THEN 0
        WHEN s.status = 'canceled'
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end > now()
          THEN 1
        ELSE 2
      END,
      s.created_at DESC
  ),
  latest_usage AS (
    SELECT DISTINCT ON (up.account_id)
      up.*
    FROM public.usage_periods up
    ORDER BY up.account_id, up.period_start DESC
  ),
  latest_entitlements AS (
    SELECT DISTINCT ON (ae.account_id)
      ae.*
    FROM public.account_entitlements ae
    ORDER BY ae.account_id, ae.period_start DESC
  ),
  test_stats AS (
    SELECT
      t.account_id,
      COUNT(*)::int AS tests_count,
      MAX(COALESCE(t.analyzed_at, t.created_at)) AS last_scan_at
    FROM public.tests t
    GROUP BY t.account_id
  )
  SELECT
    a.id AS account_id,
    pm.user_id,
    p.email,
    p.full_name,
    a.name AS account_name,
    a.status AS account_status,
    pm.role AS member_role,
    pm.created_at AS joined_at,
    ls.id AS subscription_id,
    ls.plan_id,
    ls.status AS subscription_status,
    ls.provider AS subscription_provider,
    ls.current_period_start,
    ls.current_period_end,
    COALESCE(le.included_pools, 1)::int AS included_pools,
    COALESCE(le.extra_pools, 0)::int AS extra_pools,
    COALESCE(lu.pools_limit, le.total_pool_limit, 1)::int AS total_pool_limit,
    COALESCE(lu.pools_active_count, 0)::int AS pools_active_count,
    COALESCE(le.included_scans, 200)::int AS included_scans,
    COALESCE(le.extra_scan_packs, 0)::int AS extra_scan_packs,
    COALESCE(lu.scans_limit, le.total_scan_limit, 200)::int AS total_scan_limit,
    COALESCE(lu.scans_used, 0)::int AS scans_used,
    COALESCE(lu.scans_billable, 0)::int AS scans_billable,
    GREATEST(COALESCE(lu.scans_limit, le.total_scan_limit, 200) - COALESCE(lu.scans_billable, 0), 0)::int AS scans_remaining,
    COALESCE(ts.tests_count, 0)::int AS tests_count,
    ts.last_scan_at
  FROM public.accounts a
  LEFT JOIN primary_member pm ON pm.account_id = a.id
  LEFT JOIN public.profiles p ON p.id = pm.user_id
  LEFT JOIN latest_subscription ls ON ls.account_id = a.id
  LEFT JOIN latest_usage lu ON lu.account_id = a.id
  LEFT JOIN latest_entitlements le ON le.account_id = a.id
  LEFT JOIN test_stats ts ON ts.account_id = a.id
  ORDER BY
    COALESCE(ts.last_scan_at, pm.created_at, a.created_at) DESC NULLS LAST,
    a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_subscription(
  p_account_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_pool_limit int DEFAULT 1,
  p_scan_limit int DEFAULT 200,
  p_plan_id text DEFAULT 'basic_monthly'
)
RETURNS TABLE (
  account_id uuid,
  user_id uuid,
  email text,
  full_name text,
  account_name text,
  account_status text,
  member_role text,
  joined_at timestamptz,
  subscription_id uuid,
  plan_id text,
  subscription_status text,
  subscription_provider text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  included_pools int,
  extra_pools int,
  total_pool_limit int,
  pools_active_count int,
  included_scans int,
  extra_scan_packs int,
  total_scan_limit int,
  scans_used int,
  scans_billable int,
  scans_remaining int,
  tests_count int,
  last_scan_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_subscription_id uuid;
  v_extra_pool_quantity int;
  v_scan_pack_quantity int;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RAISE EXCEPTION 'invalid_subscription_period';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = p_account_id) THEN
    RAISE EXCEPTION 'account_not_found';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.plans
  WHERE id = p_plan_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  p_pool_limit := GREATEST(COALESCE(p_pool_limit, v_plan.included_pools), v_plan.included_pools);
  p_scan_limit := GREATEST(COALESCE(p_scan_limit, v_plan.included_scans_per_month), v_plan.included_scans_per_month);

  v_extra_pool_quantity := GREATEST(p_pool_limit - v_plan.included_pools, 0);
  v_scan_pack_quantity := CEIL(GREATEST(p_scan_limit - v_plan.included_scans_per_month, 0)::numeric / 200)::int;

  UPDATE public.subscriptions s
  SET
    status = 'canceled',
    cancel_at_period_end = true,
    current_period_end = LEAST(COALESCE(s.current_period_end, p_start), p_start),
    updated_at = now()
  WHERE s.account_id = p_account_id
    AND s.provider = 'admin'
    AND s.status IN ('trialing', 'active', 'past_due');

  UPDATE public.subscription_addons sa
  SET
    status = 'canceled',
    current_period_end = LEAST(COALESCE(sa.current_period_end, p_start), p_start),
    updated_at = now()
  WHERE sa.account_id = p_account_id
    AND sa.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.id = sa.subscription_id
        AND s.provider = 'admin'
    );

  INSERT INTO public.subscriptions (
    account_id,
    plan_id,
    provider,
    provider_subscription_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end
  )
  VALUES (
    p_account_id,
    p_plan_id,
    'admin',
    'admin_' || p_account_id::text || '_' || EXTRACT(EPOCH FROM now())::bigint::text,
    'active',
    p_start,
    p_end,
    false
  )
  RETURNING id INTO v_subscription_id;

  IF v_extra_pool_quantity > 0 THEN
    INSERT INTO public.subscription_addons (
      subscription_id,
      account_id,
      addon_id,
      quantity,
      status,
      current_period_start,
      current_period_end
    )
    VALUES (
      v_subscription_id,
      p_account_id,
      'extra_pool_monthly',
      v_extra_pool_quantity,
      'active',
      p_start,
      p_end
    );
  END IF;

  IF v_scan_pack_quantity > 0 THEN
    INSERT INTO public.subscription_addons (
      subscription_id,
      account_id,
      addon_id,
      quantity,
      status,
      current_period_start,
      current_period_end
    )
    VALUES (
      v_subscription_id,
      p_account_id,
      'extra_scan_pack_200',
      v_scan_pack_quantity,
      'active',
      p_start,
      p_end
    );
  END IF;

  PERFORM public.refresh_usage_period(p_account_id);

  RETURN QUERY
  SELECT *
  FROM public.admin_dashboard_users() adu
  WHERE adu.account_id = p_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_grant_subscription(uuid, timestamptz, timestamptz, int, int, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(uuid, timestamptz, timestamptz, int, int, text) TO authenticated;
