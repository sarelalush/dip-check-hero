-- Preserve function OIDs used by RLS/triggers while keeping privileged code
-- outside the Data API. Public RPCs retain their original arguments/defaults.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_internal_service() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce(auth.jwt()->>'role','') = 'service_role'
    or (session_user in ('postgres','supabase_admin') and coalesce(auth.jwt()->>'role','') = '');
$$;
revoke all on function private.is_internal_service() from public, anon;
grant execute on function private.is_internal_service() to authenticated, service_role;


alter function public.account_has_active_subscription(uuid) set schema private;

CREATE OR REPLACE FUNCTION private.account_has_active_subscription(p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.is_account_member(p_account_id)
    AND EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.account_id = p_account_id
        AND COALESCE(s.provider, '') <> 'dev'
        AND (
          (s.status IN ('active', 'trialing') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end > now())
        )
    );
$function$;


create function public.account_has_active_subscription(p_account_id uuid) returns boolean
language sql security invoker set search_path = '' as $wrapper$
  select * from private.account_has_active_subscription(p_account_id);
$wrapper$;

revoke all on function private.account_has_active_subscription(uuid), public.account_has_active_subscription(uuid) from public, anon, authenticated;
grant execute on function private.account_has_active_subscription(uuid), public.account_has_active_subscription(uuid) to authenticated, service_role;

alter function public.account_has_active_subscription_for_user(uuid,uuid) set schema private;

CREATE OR REPLACE FUNCTION private.account_has_active_subscription_for_user(p_account_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.is_account_member(p_account_id, p_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.account_id = p_account_id
        AND COALESCE(s.provider, '') <> 'dev'
        AND (
          (s.status IN ('active', 'trialing') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end > now())
        )
    );
$function$;


create function public.account_has_active_subscription_for_user(p_account_id uuid, p_user_id uuid) returns boolean
language sql security invoker set search_path = '' as $wrapper$
  select * from private.account_has_active_subscription_for_user(p_account_id, p_user_id);
$wrapper$;

revoke all on function private.account_has_active_subscription_for_user(uuid,uuid), public.account_has_active_subscription_for_user(uuid,uuid) from public, anon, authenticated;
grant execute on function private.account_has_active_subscription_for_user(uuid,uuid), public.account_has_active_subscription_for_user(uuid,uuid) to authenticated, service_role;

alter function public.account_member_role(uuid,uuid) set schema private;

CREATE OR REPLACE FUNCTION private.account_member_role(p_account_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT am.role
  FROM public.account_members am
  WHERE (private.is_internal_service() OR p_user_id = auth.uid())
    AND am.account_id = p_account_id
    AND am.user_id = p_user_id
  LIMIT 1;
$function$;


create function public.account_member_role(p_account_id uuid, p_user_id uuid DEFAULT auth.uid()) returns text
language sql security invoker set search_path = '' as $wrapper$
  select * from private.account_member_role(p_account_id, p_user_id);
$wrapper$;

revoke all on function private.account_member_role(uuid,uuid), public.account_member_role(uuid,uuid) from public, anon, authenticated;
grant execute on function private.account_member_role(uuid,uuid), public.account_member_role(uuid,uuid) to authenticated, service_role;

alter function public.admin_dashboard_scans(uuid,integer) set schema private;

CREATE OR REPLACE FUNCTION private.admin_dashboard_scans(p_account_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 250)
 RETURNS TABLE(test_id uuid, account_id uuid, user_id uuid, email text, full_name text, pool_id uuid, pool_name text, strip_brand_id text, analysis_status text, overall_status text, provider text, model text, confidence numeric, low_confidence boolean, is_billable boolean, image_url text, image_path text, recommendation text, error_message text, readings jsonb, recommendations jsonb, analyzed_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_limit int;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 250), 1), 500);

  RETURN QUERY
  SELECT
    t.id AS test_id,
    t.account_id,
    t.user_id,
    p.email,
    p.full_name,
    t.pool_id,
    po.name AS pool_name,
    t.strip_brand_id,
    t.analysis_status,
    t.overall_status,
    t.provider,
    t.model,
    t.confidence,
    t.low_confidence,
    t.is_billable,
    t.image_url,
    t.image_path,
    t.recommendation,
    t.error_message,
    COALESCE(r.readings, '[]'::jsonb) AS readings,
    COALESCE(rec.recommendations, '[]'::jsonb) AS recommendations,
    t.analyzed_at,
    t.created_at
  FROM public.tests t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.pools po ON po.id = t.pool_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'key', tr.parameter_key,
        'label', tr.label,
        'value', tr.value,
        'unit', tr.unit,
        'status', tr.status,
        'confidence', tr.confidence,
        'min', tr.min_value,
        'max', tr.max_value,
        'raw', tr.raw
      )
      ORDER BY
        CASE tr.parameter_key
          WHEN 'alkalinity' THEN 1
          WHEN 'ph' THEN 2
          WHEN 'chlorine' THEN 3
          WHEN 'free_chlorine' THEN 4
          WHEN 'total_chlorine' THEN 5
          WHEN 'cyanuric_acid' THEN 6
          WHEN 'cya' THEN 7
          ELSE 20
        END,
        tr.parameter_key
    ) AS readings
    FROM public.test_readings tr
    WHERE tr.test_id = t.id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'parameter_key', trec.parameter_key,
        'priority', trec.priority,
        'action_type', trec.action_type,
        'title', trec.title,
        'description', trec.description,
        'amount', trec.amount,
        'unit', trec.unit,
        'product_type', trec.product_type,
        'safety_note', trec.safety_note,
        'raw', trec.raw
      )
      ORDER BY trec.priority DESC, trec.created_at ASC
    ) AS recommendations
    FROM public.test_recommendations trec
    WHERE trec.test_id = t.id
  ) rec ON true
  WHERE p_account_id IS NULL
     OR t.account_id = p_account_id
  ORDER BY COALESCE(t.analyzed_at, t.created_at) DESC
  LIMIT v_limit;
END;
$function$;


create function public.admin_dashboard_scans(p_account_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 250) returns TABLE(test_id uuid, account_id uuid, user_id uuid, email text, full_name text, pool_id uuid, pool_name text, strip_brand_id text, analysis_status text, overall_status text, provider text, model text, confidence numeric, low_confidence boolean, is_billable boolean, image_url text, image_path text, recommendation text, error_message text, readings jsonb, recommendations jsonb, analyzed_at timestamp with time zone, created_at timestamp with time zone)
language sql security invoker set search_path = '' as $wrapper$
  select * from private.admin_dashboard_scans(p_account_id, p_limit);
$wrapper$;

revoke all on function private.admin_dashboard_scans(uuid,integer), public.admin_dashboard_scans(uuid,integer) from public, anon, authenticated;
grant execute on function private.admin_dashboard_scans(uuid,integer), public.admin_dashboard_scans(uuid,integer) to authenticated, service_role;

alter function public.admin_dashboard_users() set schema private;

CREATE OR REPLACE FUNCTION private.admin_dashboard_users()
 RETURNS TABLE(account_id uuid, user_id uuid, email text, full_name text, account_name text, account_status text, member_role text, joined_at timestamp with time zone, subscription_id uuid, plan_id text, subscription_status text, subscription_provider text, current_period_start timestamp with time zone, current_period_end timestamp with time zone, included_pools integer, extra_pools integer, total_pool_limit integer, pools_active_count integer, included_scans integer, extra_scan_packs integer, total_scan_limit integer, scans_used integer, scans_billable integer, scans_remaining integer, tests_count integer, last_scan_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;


create function public.admin_dashboard_users() returns TABLE(account_id uuid, user_id uuid, email text, full_name text, account_name text, account_status text, member_role text, joined_at timestamp with time zone, subscription_id uuid, plan_id text, subscription_status text, subscription_provider text, current_period_start timestamp with time zone, current_period_end timestamp with time zone, included_pools integer, extra_pools integer, total_pool_limit integer, pools_active_count integer, included_scans integer, extra_scan_packs integer, total_scan_limit integer, scans_used integer, scans_billable integer, scans_remaining integer, tests_count integer, last_scan_at timestamp with time zone)
language sql security invoker set search_path = '' as $wrapper$
  select * from private.admin_dashboard_users();
$wrapper$;

revoke all on function private.admin_dashboard_users(), public.admin_dashboard_users() from public, anon, authenticated;
grant execute on function private.admin_dashboard_users(), public.admin_dashboard_users() to authenticated, service_role;

alter function public.admin_grant_subscription(uuid,timestamp with time zone,timestamp with time zone,integer,integer,text) set schema private;

CREATE OR REPLACE FUNCTION private.admin_grant_subscription(p_account_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_pool_limit integer DEFAULT 1, p_scan_limit integer DEFAULT 200, p_plan_id text DEFAULT 'basic_monthly'::text)
 RETURNS TABLE(account_id uuid, user_id uuid, email text, full_name text, account_name text, account_status text, member_role text, joined_at timestamp with time zone, subscription_id uuid, plan_id text, subscription_status text, subscription_provider text, current_period_start timestamp with time zone, current_period_end timestamp with time zone, included_pools integer, extra_pools integer, total_pool_limit integer, pools_active_count integer, included_scans integer, extra_scan_packs integer, total_scan_limit integer, scans_used integer, scans_billable integer, scans_remaining integer, tests_count integer, last_scan_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;


create function public.admin_grant_subscription(p_account_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_pool_limit integer DEFAULT 1, p_scan_limit integer DEFAULT 200, p_plan_id text DEFAULT 'basic_monthly'::text) returns TABLE(account_id uuid, user_id uuid, email text, full_name text, account_name text, account_status text, member_role text, joined_at timestamp with time zone, subscription_id uuid, plan_id text, subscription_status text, subscription_provider text, current_period_start timestamp with time zone, current_period_end timestamp with time zone, included_pools integer, extra_pools integer, total_pool_limit integer, pools_active_count integer, included_scans integer, extra_scan_packs integer, total_scan_limit integer, scans_used integer, scans_billable integer, scans_remaining integer, tests_count integer, last_scan_at timestamp with time zone)
language sql security invoker set search_path = '' as $wrapper$
  select * from private.admin_grant_subscription(p_account_id, p_start, p_end, p_pool_limit, p_scan_limit, p_plan_id);
$wrapper$;

revoke all on function private.admin_grant_subscription(uuid,timestamp with time zone,timestamp with time zone,integer,integer,text), public.admin_grant_subscription(uuid,timestamp with time zone,timestamp with time zone,integer,integer,text) from public, anon, authenticated;
grant execute on function private.admin_grant_subscription(uuid,timestamp with time zone,timestamp with time zone,integer,integer,text), public.admin_grant_subscription(uuid,timestamp with time zone,timestamp with time zone,integer,integer,text) to authenticated, service_role;

alter function public.begin_strip_analysis_provider_call(uuid,text,text) set schema private;

CREATE OR REPLACE FUNCTION private.begin_strip_analysis_provider_call(p_user_id uuid, p_test_id text, p_image_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_updated integer := 0;
begin
  update public.strip_analysis_requests
  set
    provider_call_count = 1,
    provider_started_at = now(),
    updated_at = now()
  where user_id = p_user_id
    and test_id = p_test_id
    and image_key = p_image_key
    and status = 'processing'
    and provider_call_count = 0;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;


create function public.begin_strip_analysis_provider_call(p_user_id uuid, p_test_id text, p_image_key text) returns boolean
language sql security invoker set search_path = '' as $wrapper$
  select * from private.begin_strip_analysis_provider_call(p_user_id, p_test_id, p_image_key);
$wrapper$;

revoke all on function private.begin_strip_analysis_provider_call(uuid,text,text), public.begin_strip_analysis_provider_call(uuid,text,text) from public, anon, authenticated;
grant execute on function private.begin_strip_analysis_provider_call(uuid,text,text), public.begin_strip_analysis_provider_call(uuid,text,text) to service_role;

alter function public.can_create_pool(uuid) set schema private;

CREATE OR REPLACE FUNCTION private.can_create_pool(p_account_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
BEGIN
  IF NOT public.account_has_active_subscription(p_account_id) THEN
    RETURN false;
  END IF;

  v_usage := public.refresh_usage_period(p_account_id);
  RETURN v_usage.pools_active_count < v_usage.pools_limit;
END;
$function$;


create function public.can_create_pool(p_account_id uuid) returns boolean
language sql security invoker set search_path = '' as $wrapper$
  select * from private.can_create_pool(p_account_id);
$wrapper$;

revoke all on function private.can_create_pool(uuid), public.can_create_pool(uuid) from public, anon, authenticated;
grant execute on function private.can_create_pool(uuid), public.can_create_pool(uuid) to authenticated, service_role;

alter function public.can_create_scan(uuid) set schema private;

CREATE OR REPLACE FUNCTION private.can_create_scan(p_account_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
BEGIN
  IF NOT public.account_has_active_subscription(p_account_id) THEN
    RETURN false;
  END IF;

  v_usage := public.refresh_usage_period(p_account_id);
  RETURN v_usage.scans_billable < v_usage.scans_limit;
END;
$function$;


create function public.can_create_scan(p_account_id uuid) returns boolean
language sql security invoker set search_path = '' as $wrapper$
  select * from private.can_create_scan(p_account_id);
$wrapper$;

revoke all on function private.can_create_scan(uuid), public.can_create_scan(uuid) from public, anon, authenticated;
grant execute on function private.can_create_scan(uuid), public.can_create_scan(uuid) to authenticated, service_role;

alter function public.can_create_scan_for_user(uuid,uuid) set schema private;

CREATE OR REPLACE FUNCTION private.can_create_scan_for_user(p_account_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
BEGIN
  IF NOT public.account_has_active_subscription_for_user(p_account_id, p_user_id) THEN
    RETURN false;
  END IF;

  v_usage := public.refresh_usage_period(p_account_id);
  RETURN v_usage.scans_billable < v_usage.scans_limit;
END;
$function$;


create function public.can_create_scan_for_user(p_account_id uuid, p_user_id uuid) returns boolean
language sql security invoker set search_path = '' as $wrapper$
  select * from private.can_create_scan_for_user(p_account_id, p_user_id);
$wrapper$;

revoke all on function private.can_create_scan_for_user(uuid,uuid), public.can_create_scan_for_user(uuid,uuid) from public, anon, authenticated;
grant execute on function private.can_create_scan_for_user(uuid,uuid), public.can_create_scan_for_user(uuid,uuid) to authenticated, service_role;

alter function public.can_manage_account_content(uuid,uuid) set schema private;

CREATE OR REPLACE FUNCTION private.can_manage_account_content(p_account_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(public.account_member_role(p_account_id, p_user_id), '') IN ('owner', 'admin', 'editor');
$function$;


create function public.can_manage_account_content(p_account_id uuid, p_user_id uuid DEFAULT auth.uid()) returns boolean
language sql security invoker set search_path = '' as $wrapper$
  select * from private.can_manage_account_content(p_account_id, p_user_id);
$wrapper$;

revoke all on function private.can_manage_account_content(uuid,uuid), public.can_manage_account_content(uuid,uuid) from public, anon, authenticated;
grant execute on function private.can_manage_account_content(uuid,uuid), public.can_manage_account_content(uuid,uuid) to authenticated, service_role;

alter function public.claim_strip_analysis_content(uuid,text,uuid,text,text) set schema private;

CREATE OR REPLACE FUNCTION private.claim_strip_analysis_content(p_user_id uuid, p_test_id text, p_account_id uuid, p_image_key text, p_content_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_inserted integer := 0;
  v_request public.strip_analysis_requests%rowtype;
begin
  insert into public.strip_analysis_requests (
    user_id,
    test_id,
    account_id,
    image_key,
    content_key,
    status,
    lease_expires_at
  )
  values (
    p_user_id,
    p_test_id,
    p_account_id,
    p_image_key,
    p_content_key,
    'processing',
    now() + interval '24 hours'
  )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return jsonb_build_object(
      'claimed', true,
      'status', 'processing',
      'canonicalTestId', p_test_id
    );
  end if;

  select *
  into v_request
  from public.strip_analysis_requests
  where user_id = p_user_id and test_id = p_test_id;

  if found and v_request.content_key is distinct from p_content_key then
    return jsonb_build_object(
      'claimed', false,
      'status', 'conflict',
      'canonicalTestId', v_request.test_id
    );
  end if;

  if not found then
    select *
    into v_request
    from public.strip_analysis_requests
    where user_id = p_user_id and content_key = p_content_key
    order by created_at
    limit 1;
  end if;

  if not found then
    return jsonb_build_object('claimed', false, 'status', 'conflict');
  end if;

  if v_request.status = 'completed' then
    return jsonb_build_object(
      'claimed', false,
      'status', 'completed',
      'canonicalTestId', v_request.test_id,
      'result', v_request.result
    );
  end if;

  return jsonb_build_object(
    'claimed', false,
    'status', v_request.status,
    'canonicalTestId', v_request.test_id,
    'errorCode', v_request.error_code,
    'errorMessage', v_request.error_message
  );
end;
$function$;


create function public.claim_strip_analysis_content(p_user_id uuid, p_test_id text, p_account_id uuid, p_image_key text, p_content_key text) returns jsonb
language sql security invoker set search_path = '' as $wrapper$
  select * from private.claim_strip_analysis_content(p_user_id, p_test_id, p_account_id, p_image_key, p_content_key);
$wrapper$;

revoke all on function private.claim_strip_analysis_content(uuid,text,uuid,text,text), public.claim_strip_analysis_content(uuid,text,uuid,text,text) from public, anon, authenticated;
grant execute on function private.claim_strip_analysis_content(uuid,text,uuid,text,text), public.claim_strip_analysis_content(uuid,text,uuid,text,text) to service_role;

alter function public.claim_strip_analysis_request(uuid,text,uuid,text) set schema private;

CREATE OR REPLACE FUNCTION private.claim_strip_analysis_request(p_user_id uuid, p_test_id text, p_account_id uuid, p_image_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_inserted integer := 0;
  v_request public.strip_analysis_requests%rowtype;
begin
  insert into public.strip_analysis_requests (
    user_id,
    test_id,
    account_id,
    image_key,
    status,
    lease_expires_at
  )
  values (
    p_user_id,
    p_test_id,
    p_account_id,
    p_image_key,
    'processing',
    now() + interval '24 hours'
  )
  on conflict (user_id, test_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return jsonb_build_object('claimed', true, 'status', 'processing');
  end if;

  select *
  into v_request
  from public.strip_analysis_requests
  where user_id = p_user_id and test_id = p_test_id
  for update;

  if v_request.image_key <> p_image_key then
    return jsonb_build_object('claimed', false, 'status', 'conflict');
  end if;

  if v_request.status = 'completed' then
    return jsonb_build_object(
      'claimed', false,
      'status', 'completed',
      'result', v_request.result
    );
  end if;

  -- A scan ID is immutable and never reclaimed. Retrying requires a new scan ID.
  return jsonb_build_object(
    'claimed', false,
    'status', v_request.status,
    'errorCode', v_request.error_code,
    'errorMessage', v_request.error_message
  );
end;
$function$;


create function public.claim_strip_analysis_request(p_user_id uuid, p_test_id text, p_account_id uuid, p_image_key text) returns jsonb
language sql security invoker set search_path = '' as $wrapper$
  select * from private.claim_strip_analysis_request(p_user_id, p_test_id, p_account_id, p_image_key);
$wrapper$;

revoke all on function private.claim_strip_analysis_request(uuid,text,uuid,text), public.claim_strip_analysis_request(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function private.claim_strip_analysis_request(uuid,text,uuid,text), public.claim_strip_analysis_request(uuid,text,uuid,text) to service_role;

alter function public.ensure_account_for_user(uuid,text,text,text) set schema private;

CREATE OR REPLACE FUNCTION private.ensure_account_for_user(p_user_id uuid, p_email text DEFAULT NULL::text, p_full_name text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_account_id uuid;
  v_account_name text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (p_user_id, p_email, p_full_name, p_avatar_url)
  ON CONFLICT (id)
  DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  SELECT account_id
  INTO v_account_id
  FROM public.account_members
  WHERE user_id = p_user_id
    AND role = 'owner'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_account_id IS NULL THEN
    v_account_name := COALESCE(NULLIF(p_full_name, ''), split_part(COALESCE(p_email, 'My'), '@', 1), 'My') || ' Account';

    INSERT INTO public.accounts (owner_user_id, name)
    VALUES (p_user_id, v_account_name)
    RETURNING id INTO v_account_id;

    INSERT INTO public.account_members (account_id, user_id, role)
    VALUES (v_account_id, p_user_id, 'owner')
    ON CONFLICT (account_id, user_id) DO NOTHING;
  END IF;

  PERFORM public.refresh_usage_period(v_account_id);
  RETURN v_account_id;
END;
$function$;


create function public.ensure_account_for_user(p_user_id uuid, p_email text DEFAULT NULL::text, p_full_name text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text) returns uuid
language sql security invoker set search_path = '' as $wrapper$
  select * from private.ensure_account_for_user(p_user_id, p_email, p_full_name, p_avatar_url);
$wrapper$;

revoke all on function private.ensure_account_for_user(uuid,text,text,text), public.ensure_account_for_user(uuid,text,text,text) from public, anon, authenticated;
grant execute on function private.ensure_account_for_user(uuid,text,text,text), public.ensure_account_for_user(uuid,text,text,text) to service_role;

alter function public.ensure_default_account() set schema private;

CREATE OR REPLACE FUNCTION private.ensure_default_account()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user auth.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN public.ensure_account_for_user(
    v_user.id,
    v_user.email,
    COALESCE(v_user.raw_user_meta_data ->> 'full_name', v_user.raw_user_meta_data ->> 'name'),
    v_user.raw_user_meta_data ->> 'avatar_url'
  );
END;
$function$;


create function public.ensure_default_account() returns uuid
language sql security invoker set search_path = '' as $wrapper$
  select * from private.ensure_default_account();
$wrapper$;

revoke all on function private.ensure_default_account(), public.ensure_default_account() from public, anon, authenticated;
grant execute on function private.ensure_default_account(), public.ensure_default_account() to authenticated, service_role;

alter function public.get_current_account_entitlements(uuid) set schema private;

CREATE OR REPLACE FUNCTION private.get_current_account_entitlements(p_account_id uuid)
 RETURNS public.account_entitlements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
  v_entitlements public.account_entitlements%ROWTYPE;
BEGIN
  IF NOT (private.is_internal_service() OR pg_trigger_depth() > 0
      OR public.is_current_user_admin() OR public.is_account_member(p_account_id)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  v_usage := public.refresh_usage_period(p_account_id);

  SELECT *
  INTO v_entitlements
  FROM public.account_entitlements
  WHERE account_id = p_account_id
    AND period_start = v_usage.period_start
  LIMIT 1;

  RETURN v_entitlements;
END;
$function$;


create function public.get_current_account_entitlements(p_account_id uuid) returns public.account_entitlements
language sql security invoker set search_path = '' as $wrapper$
  select * from private.get_current_account_entitlements(p_account_id);
$wrapper$;

revoke all on function private.get_current_account_entitlements(uuid), public.get_current_account_entitlements(uuid) from public, anon, authenticated;
grant execute on function private.get_current_account_entitlements(uuid), public.get_current_account_entitlements(uuid) to authenticated, service_role;

alter function public.handle_new_user() set schema private;

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.ensure_account_for_user(
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$function$;


revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;

alter function public.is_account_member(uuid,uuid) set schema private;

CREATE OR REPLACE FUNCTION private.is_account_member(p_account_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE (private.is_internal_service() OR p_user_id = auth.uid())
      AND am.account_id = p_account_id
      AND am.user_id = p_user_id
  );
$function$;


create function public.is_account_member(p_account_id uuid, p_user_id uuid DEFAULT auth.uid()) returns boolean
language sql security invoker set search_path = '' as $wrapper$
  select * from private.is_account_member(p_account_id, p_user_id);
$wrapper$;

revoke all on function private.is_account_member(uuid,uuid), public.is_account_member(uuid,uuid) from public, anon, authenticated;
grant execute on function private.is_account_member(uuid,uuid), public.is_account_member(uuid,uuid) to authenticated, service_role;

alter function public.is_current_user_admin() set schema private;

CREATE OR REPLACE FUNCTION private.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  );
$function$;


create function public.is_current_user_admin() returns boolean
language sql security invoker set search_path = '' as $wrapper$
  select * from private.is_current_user_admin();
$wrapper$;

revoke all on function private.is_current_user_admin(), public.is_current_user_admin() from public, anon, authenticated;
grant execute on function private.is_current_user_admin(), public.is_current_user_admin() to authenticated, service_role;

alter function public.refresh_account_entitlements_from_billing_change() set schema private;

CREATE OR REPLACE FUNCTION private.refresh_account_entitlements_from_billing_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_account_id uuid;
BEGIN
  v_account_id := COALESCE(NEW.account_id, OLD.account_id);

  IF v_account_id IS NOT NULL THEN
    PERFORM public.refresh_usage_period(v_account_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;


revoke all on function private.refresh_account_entitlements_from_billing_change() from public, anon, authenticated, service_role;

alter function public.refresh_usage_period(uuid) set schema private;

CREATE OR REPLACE FUNCTION private.refresh_usage_period(p_account_id uuid)
 RETURNS public.usage_periods
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_period_start date;
  v_period_end date;
  v_extra_pools int := 0;
  v_extra_scan_packs int := 0;
  v_included_pools int := 1;
  v_included_scans int := 200;
  v_total_pool_limit int := 1;
  v_total_scan_limit int := 200;
  v_scans_used int := 0;
  v_scans_billable int := 0;
  v_pools_active_count int := 0;
  v_usage public.usage_periods%ROWTYPE;
BEGIN
  IF NOT (private.is_internal_service() OR pg_trigger_depth() > 0
      OR public.is_current_user_admin() OR public.is_account_member(p_account_id)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  SELECT *
  INTO v_subscription
  FROM public.subscriptions
  WHERE account_id = p_account_id
    AND status IN ('trialing', 'active', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND AND v_subscription.plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE id = v_subscription.plan_id;
    IF FOUND THEN
      v_included_pools := v_plan.included_pools;
      v_included_scans := v_plan.included_scans_per_month;
    END IF;
  END IF;

  v_period_start := COALESCE(v_subscription.current_period_start::date, date_trunc('month', now())::date);
  v_period_end := COALESCE(v_subscription.current_period_end::date, (date_trunc('month', now()) + interval '1 month')::date);

  SELECT
    COALESCE(SUM(CASE WHEN pa.addon_type = 'extra_pool' AND sa.status = 'active' THEN sa.quantity * pa.quantity_unit ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pa.addon_type = 'scan_pack' AND sa.status = 'active' THEN sa.quantity ELSE 0 END), 0)
  INTO v_extra_pools, v_extra_scan_packs
  FROM public.subscription_addons sa
  JOIN public.plan_addons pa ON pa.id = sa.addon_id
  WHERE sa.account_id = p_account_id
    AND sa.status = 'active'
    AND (sa.current_period_start IS NULL OR sa.current_period_start::date <= v_period_end)
    AND (sa.current_period_end IS NULL OR sa.current_period_end::date >= v_period_start);

  v_total_pool_limit := v_included_pools + v_extra_pools;
  v_total_scan_limit := v_included_scans + (v_extra_scan_packs * 200);

  SELECT COUNT(*)::int
  INTO v_pools_active_count
  FROM public.pools
  WHERE account_id = p_account_id
    AND is_archived = false;

  SELECT
    COALESCE(SUM(quantity), 0)::int,
    COALESCE(SUM(CASE WHEN billable THEN quantity ELSE 0 END), 0)::int
  INTO v_scans_used, v_scans_billable
  FROM public.usage_events
  WHERE account_id = p_account_id
    AND event_type = 'scan'
    AND period_start = v_period_start;

  INSERT INTO public.account_entitlements (
    account_id,
    period_start,
    period_end,
    included_pools,
    extra_pools,
    total_pool_limit,
    included_scans,
    extra_scan_packs,
    total_scan_limit
  )
  VALUES (
    p_account_id,
    v_period_start,
    v_period_end,
    v_included_pools,
    v_extra_pools,
    v_total_pool_limit,
    v_included_scans,
    v_extra_scan_packs,
    v_total_scan_limit
  )
  ON CONFLICT (account_id, period_start)
  DO UPDATE SET
    period_end = EXCLUDED.period_end,
    included_pools = EXCLUDED.included_pools,
    extra_pools = EXCLUDED.extra_pools,
    total_pool_limit = EXCLUDED.total_pool_limit,
    included_scans = EXCLUDED.included_scans,
    extra_scan_packs = EXCLUDED.extra_scan_packs,
    total_scan_limit = EXCLUDED.total_scan_limit,
    updated_at = now();

  INSERT INTO public.usage_periods (
    account_id,
    period_start,
    period_end,
    scans_used,
    scans_billable,
    scans_limit,
    pools_active_count,
    pools_limit
  )
  VALUES (
    p_account_id,
    v_period_start,
    v_period_end,
    v_scans_used,
    v_scans_billable,
    v_total_scan_limit,
    v_pools_active_count,
    v_total_pool_limit
  )
  ON CONFLICT (account_id, period_start)
  DO UPDATE SET
    period_end = EXCLUDED.period_end,
    scans_used = EXCLUDED.scans_used,
    scans_billable = EXCLUDED.scans_billable,
    scans_limit = EXCLUDED.scans_limit,
    pools_active_count = EXCLUDED.pools_active_count,
    pools_limit = EXCLUDED.pools_limit,
    updated_at = now()
  RETURNING * INTO v_usage;

  RETURN v_usage;
END;
$function$;


create function public.refresh_usage_period(p_account_id uuid) returns public.usage_periods
language sql security invoker set search_path = '' as $wrapper$
  select * from private.refresh_usage_period(p_account_id);
$wrapper$;

revoke all on function private.refresh_usage_period(uuid), public.refresh_usage_period(uuid) from public, anon, authenticated;
grant execute on function private.refresh_usage_period(uuid), public.refresh_usage_period(uuid) to authenticated, service_role;

alter function public.register_scan_usage(uuid,uuid,uuid) set schema private;

CREATE OR REPLACE FUNCTION private.register_scan_usage(p_account_id uuid, p_user_id uuid, p_test_id uuid)
 RETURNS public.usage_periods
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
  v_is_billable boolean := true;
BEGIN
  v_usage := public.refresh_usage_period(p_account_id);

  SELECT COALESCE(is_billable, true)
  INTO v_is_billable
  FROM public.tests
  WHERE id = p_test_id
    AND account_id = p_account_id;

  INSERT INTO public.usage_events (account_id, user_id, test_id, event_type, quantity, billable, period_start)
  VALUES (p_account_id, p_user_id, p_test_id, 'scan', 1, COALESCE(v_is_billable, true), v_usage.period_start);

  RETURN public.refresh_usage_period(p_account_id);
END;
$function$;


create function public.register_scan_usage(p_account_id uuid, p_user_id uuid, p_test_id uuid) returns public.usage_periods
language sql security invoker set search_path = '' as $wrapper$
  select * from private.register_scan_usage(p_account_id, p_user_id, p_test_id);
$wrapper$;

revoke all on function private.register_scan_usage(uuid,uuid,uuid), public.register_scan_usage(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function private.register_scan_usage(uuid,uuid,uuid), public.register_scan_usage(uuid,uuid,uuid) to service_role;

-- Caller identity cannot be selected through a membership RPC. The service
-- still supplies explicit IDs after validating the user's access token.
create or replace function private.register_scan_usage(p_account_id uuid,p_user_id uuid,p_test_id uuid)
returns public.usage_periods language plpgsql security definer set search_path='' as $$
declare v_usage public.usage_periods%rowtype; v_result jsonb;
begin
  if not private.is_internal_service() then
    raise exception 'server_only' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 2));
  if not exists(select 1 from public.tests where id=p_test_id
      and account_id=p_account_id and user_id=p_user_id) then
    raise exception 'test_scope_mismatch' using errcode='42501';
  end if;
  select result into v_result from public.strip_analysis_requests
    where user_id=p_user_id and test_id=p_test_id::text
      and account_id=p_account_id and status='completed' and provider_call_count=1;
  if v_result is null then raise exception 'analysis_not_completed'; end if;
  v_usage := public.refresh_usage_period(p_account_id);
  -- Billability comes from the server's completion record, never client tests.
  if coalesce((v_result->>'isValidStrip')::boolean,true) = false then return v_usage; end if;
  if not exists(select 1 from public.usage_events
      where account_id=p_account_id and test_id=p_test_id and event_type='scan') then
    insert into public.usage_events(account_id,user_id,test_id,event_type,quantity,billable,period_start)
      values(p_account_id,p_user_id,p_test_id,'scan',1,true,v_usage.period_start);
  end if;
  return public.refresh_usage_period(p_account_id);
end; $$;
create index if not exists usage_events_scan_lookup
  on public.usage_events(account_id,test_id) where event_type='scan';

-- Reserve quota under the same account lock used by usage registration.
-- Count in-flight and completed-but-not-yet-registered provider calls so
-- simultaneous requests cannot all consume the final available scan.
create or replace function private.begin_strip_analysis_provider_call(p_user_id uuid,p_test_id text,p_image_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_account uuid; v_usage public.usage_periods%rowtype; v_reserved integer; v_updated integer;
begin
  if not private.is_internal_service() then raise exception 'server_only' using errcode='42501'; end if;
  select account_id into v_account from public.strip_analysis_requests
    where user_id=p_user_id and test_id=p_test_id and image_key=p_image_key
      and status='processing' and provider_call_count=0;
  if v_account is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account::text,2));
  if not public.can_manage_account_content(v_account,p_user_id)
    or not public.account_has_active_subscription_for_user(v_account,p_user_id) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  v_usage := public.refresh_usage_period(v_account);
  select count(*) into v_reserved from public.strip_analysis_requests r
    where r.account_id=v_account and r.provider_call_count=1
      and r.provider_started_at >= v_usage.period_start::timestamptz
      and (r.status='processing' and r.lease_expires_at > now()
        or r.status='completed' and coalesce((r.result->>'isValidStrip')::boolean,true))
      and not exists(select 1 from public.usage_events e
        where e.account_id=v_account and e.test_id::text=r.test_id and e.event_type='scan');
  if v_usage.scans_billable + v_reserved >= v_usage.scans_limit then
    raise exception 'scan_quota_exhausted';
  end if;
  update public.strip_analysis_requests set provider_call_count=1,provider_started_at=now(),updated_at=now()
    where user_id=p_user_id and test_id=p_test_id and image_key=p_image_key
      and status='processing' and provider_call_count=0;
  get diagnostics v_updated=row_count;
  return v_updated=1;
end; $$;

-- Viewer memberships allow reading, not changing another member's history.
alter policy "tests account users insert" on public.tests with check (
  public.can_manage_account_content(account_id) and public.account_has_active_subscription(account_id)
  and user_id=auth.uid());
alter policy "tests account users update" on public.tests
  using (public.can_manage_account_content(account_id))
  with check (public.can_manage_account_content(account_id));
alter policy "test readings members write" on public.test_readings
  using (public.can_manage_account_content(account_id))
  with check (public.can_manage_account_content(account_id) and exists(
    select 1 from public.tests t where t.id=test_id and t.account_id=test_readings.account_id));
alter policy "test recommendations members write" on public.test_recommendations
  using (public.can_manage_account_content(account_id))
  with check (public.can_manage_account_content(account_id) and exists(
    select 1 from public.tests t where t.id=test_id and t.account_id=test_recommendations.account_id));
alter policy "scan image metadata members write" on public.scan_image_metadata
  using (public.can_manage_account_content(account_id))
  with check (public.can_manage_account_content(account_id) and exists(
    select 1 from public.tests t where t.id=test_id and t.account_id=scan_image_metadata.account_id)
    and bucket='scan-images' and path like 'accounts/'||account_id::text||'/%');

-- Scope is immutable even when the caller belongs to both source and target
-- accounts. These triggers also protect service upserts against ID collisions.
create or replace function private.guard_content_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare linked_account uuid;
begin
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.account_id is distinct from old.account_id) then
    raise exception 'immutable_content_scope' using errcode='42501';
  end if;
  if tg_table_name='tests' then
    if tg_op='UPDATE' and new.user_id is distinct from old.user_id
      and not (new.user_id is null and not exists(select 1 from auth.users where id=old.user_id)) then
      raise exception 'immutable_test_author' using errcode='42501';
    end if;
    if new.pool_id is not null then
      select account_id into linked_account from public.pools where id=new.pool_id;
      if linked_account is distinct from new.account_id then raise exception 'pool_scope_mismatch'; end if;
    end if;
  elsif tg_table_name='pools' then
    if tg_op='UPDATE' and new.owner_user_id is distinct from old.owner_user_id
      and not (new.owner_user_id is null and not exists(select 1 from auth.users where id=old.owner_user_id)) then
      raise exception 'immutable_pool_owner' using errcode='42501';
    end if;
  else
    if tg_op='UPDATE' and new.test_id is distinct from old.test_id then
      raise exception 'immutable_test_link' using errcode='42501';
    end if;
    select account_id into linked_account from public.tests where id=new.test_id;
    if linked_account is distinct from new.account_id then raise exception 'test_scope_mismatch'; end if;
  end if;
  return new;
end; $$;
revoke all on function private.guard_content_scope() from public,anon,authenticated,service_role;
create trigger guard_content_scope before insert or update on public.tests
  for each row execute function private.guard_content_scope();
create trigger guard_content_scope before insert or update on public.pools
  for each row execute function private.guard_content_scope();
create trigger guard_content_scope before insert or update on public.test_readings
  for each row execute function private.guard_content_scope();
create trigger guard_content_scope before insert or update on public.test_recommendations
  for each row execute function private.guard_content_scope();
create trigger guard_content_scope before insert or update on public.scan_image_metadata
  for each row execute function private.guard_content_scope();

notify pgrst,'reload schema';
