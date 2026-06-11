-- Production account-based schema for Dip Check Hero / AquaSense mobile.
-- This migration intentionally replaces the older user-only Lovable schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS public.scan_image_metadata CASCADE;
DROP TABLE IF EXISTS public.billing_events CASCADE;
DROP TABLE IF EXISTS public.usage_events CASCADE;
DROP TABLE IF EXISTS public.usage_periods CASCADE;
DROP TABLE IF EXISTS public.test_recommendations CASCADE;
DROP TABLE IF EXISTS public.test_readings CASCADE;
DROP TABLE IF EXISTS public.tests CASCADE;
DROP TABLE IF EXISTS public.strip_brands CASCADE;
DROP TABLE IF EXISTS public.pools CASCADE;
DROP TABLE IF EXISTS public.account_entitlements CASCADE;
DROP TABLE IF EXISTS public.subscription_addons CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.plan_addons CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.account_members CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.strip_brand_requests CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

DROP FUNCTION IF EXISTS public.get_current_account_entitlements(uuid);
DROP FUNCTION IF EXISTS public.can_create_pool(uuid);
DROP FUNCTION IF EXISTS public.can_create_scan(uuid);
DROP FUNCTION IF EXISTS public.register_scan_usage(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.refresh_usage_period(uuid);
DROP FUNCTION IF EXISTS public.ensure_default_account();
DROP FUNCTION IF EXISTS public.ensure_account_for_user(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.is_account_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.account_member_role(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_manage_account_content(uuid, uuid);
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_user_role();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  locale text NOT NULL DEFAULT 'he-IL',
  units text NOT NULL DEFAULT 'metric',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  billing_interval text NOT NULL DEFAULT 'month',
  base_price_cents int NOT NULL,
  included_pools int NOT NULL DEFAULT 1,
  included_scans_per_month int NOT NULL DEFAULT 200,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_addons (
  id text PRIMARY KEY,
  name text NOT NULL,
  addon_type text NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  price_cents int NOT NULL,
  quantity_unit int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id text REFERENCES public.plans(id),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  status text NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  addon_id text REFERENCES public.plan_addons(id),
  quantity int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.account_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  included_pools int NOT NULL DEFAULT 1,
  extra_pools int NOT NULL DEFAULT 0,
  total_pool_limit int NOT NULL DEFAULT 1,
  included_scans int NOT NULL DEFAULT 200,
  extra_scan_packs int NOT NULL DEFAULT 0,
  total_scan_limit int NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, period_start)
);

CREATE TABLE public.pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  pool_type text,
  sanitizer_type text,
  volume_liters numeric,
  shape text,
  dimensions jsonb NOT NULL DEFAULT '{}',
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.strip_brands (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  manufacturer text,
  pad_count int NOT NULL,
  parameter_order jsonb NOT NULL,
  color_chart jsonb NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  strip_brand_id text REFERENCES public.strip_brands(id),
  image_path text,
  image_url text,
  analysis_status text NOT NULL DEFAULT 'pending',
  source text,
  provider text,
  model text,
  confidence numeric,
  low_confidence boolean NOT NULL DEFAULT false,
  overall_status text,
  recommendation text,
  raw_result jsonb NOT NULL DEFAULT '{}',
  error_message text,
  is_billable boolean NOT NULL DEFAULT true,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.test_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  label text,
  value numeric,
  unit text,
  min_value numeric,
  max_value numeric,
  status text,
  confidence numeric,
  raw jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, parameter_key)
);

CREATE TABLE public.test_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  parameter_key text,
  priority int NOT NULL DEFAULT 0,
  action_type text,
  title text,
  description text,
  amount numeric,
  unit text,
  product_type text,
  safety_note text,
  raw jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.usage_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  scans_used int NOT NULL DEFAULT 0,
  scans_billable int NOT NULL DEFAULT 0,
  scans_limit int NOT NULL DEFAULT 200,
  pools_active_count int NOT NULL DEFAULT 0,
  pools_limit int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, period_start)
);

CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  test_id uuid REFERENCES public.tests(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  billable boolean NOT NULL DEFAULT true,
  period_start date NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_event_id text,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}',
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE public.scan_image_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  bucket text NOT NULL DEFAULT 'scan-images',
  path text NOT NULL,
  width int,
  height int,
  mime_type text,
  size_bytes int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);

CREATE TABLE public.strip_brand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  brand_name text NOT NULL,
  contact_email text,
  notes text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_members_account ON public.account_members(account_id);
CREATE INDEX idx_account_members_user ON public.account_members(user_id);
CREATE INDEX idx_accounts_owner ON public.accounts(owner_user_id);
CREATE INDEX idx_subscriptions_account ON public.subscriptions(account_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscription_addons_account ON public.subscription_addons(account_id);
CREATE INDEX idx_subscription_addons_subscription ON public.subscription_addons(subscription_id);
CREATE INDEX idx_account_entitlements_account ON public.account_entitlements(account_id);
CREATE INDEX idx_pools_account ON public.pools(account_id);
CREATE INDEX idx_pools_owner_user ON public.pools(owner_user_id);
CREATE INDEX idx_pools_is_archived ON public.pools(is_archived);
CREATE INDEX idx_tests_account ON public.tests(account_id);
CREATE INDEX idx_tests_user ON public.tests(user_id);
CREATE INDEX idx_tests_pool ON public.tests(pool_id);
CREATE INDEX idx_tests_created_at ON public.tests(created_at DESC);
CREATE INDEX idx_tests_analysis_status ON public.tests(analysis_status);
CREATE INDEX idx_test_readings_test ON public.test_readings(test_id);
CREATE INDEX idx_test_readings_account ON public.test_readings(account_id);
CREATE INDEX idx_test_readings_parameter ON public.test_readings(parameter_key);
CREATE INDEX idx_test_recommendations_test ON public.test_recommendations(test_id);
CREATE INDEX idx_test_recommendations_account ON public.test_recommendations(account_id);
CREATE INDEX idx_usage_periods_account ON public.usage_periods(account_id);
CREATE INDEX idx_usage_periods_period_start ON public.usage_periods(period_start);
CREATE INDEX idx_usage_events_account ON public.usage_events(account_id);
CREATE INDEX idx_usage_events_period_start ON public.usage_events(period_start);
CREATE INDEX idx_usage_events_event_type ON public.usage_events(event_type);
CREATE INDEX idx_usage_events_test ON public.usage_events(test_id);
CREATE INDEX idx_scan_image_metadata_account ON public.scan_image_metadata(account_id);
CREATE INDEX idx_scan_image_metadata_test ON public.scan_image_metadata(test_id);

INSERT INTO public.plans (id, name, currency, base_price_cents, included_pools, included_scans_per_month)
VALUES ('basic_monthly', 'Basic Monthly', 'ILS', 3000, 1, 200)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  currency = EXCLUDED.currency,
  base_price_cents = EXCLUDED.base_price_cents,
  included_pools = EXCLUDED.included_pools,
  included_scans_per_month = EXCLUDED.included_scans_per_month,
  updated_at = now();

INSERT INTO public.plan_addons (id, name, addon_type, currency, price_cents, quantity_unit)
VALUES
  ('extra_pool_monthly', 'Extra Pool Monthly', 'extra_pool', 'ILS', 1000, 1),
  ('extra_scan_pack_200', 'Extra 200 Scan Pack', 'scan_pack', 'ILS', 2000, 200)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  addon_type = EXCLUDED.addon_type,
  currency = EXCLUDED.currency,
  price_cents = EXCLUDED.price_cents,
  quantity_unit = EXCLUDED.quantity_unit,
  updated_at = now();

INSERT INTO public.strip_brands (id, display_name, manufacturer, pad_count, parameter_order, color_chart)
VALUES
  (
    'aquachek-pro-5in1',
    'AquaChek Pro 5-in-1',
    'AquaChek',
    4,
    '["totalChlorine","bromine","freeChlorine","ph","alkalinity"]',
    '{
      "padOrderNote": "4 physical pads; pad 1 reports total chlorine and bromine",
      "totalChlorine": [0,0.5,1,3,5,10],
      "bromine": [0,1,2,5,10,20],
      "freeChlorine": [0,0.5,1,2,4,10],
      "ph": [6.8,7.2,7.5,7.8,8.4],
      "alkalinity": [0,40,80,120,180,240]
    }'
  ),
  (
    'aquachek-yellow-4in1',
    'AquaChek Yellow 4-in-1',
    'AquaChek',
    4,
    '["freeChlorine","ph","alkalinity","cyanuricAcid"]',
    '{
      "freeChlorine": [0,0.5,1,3,5,10],
      "ph": [6.2,6.8,7.2,7.8,8.4],
      "alkalinity": [0,40,80,120,180,240],
      "cyanuricAcid": [0,30,50,100,150]
    }'
  )
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  manufacturer = EXCLUDED.manufacturer,
  pad_count = EXCLUDED.pad_count,
  parameter_order = EXCLUDED.parameter_order,
  color_chart = EXCLUDED.color_chart,
  is_enabled = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plan_addons_updated BEFORE UPDATE ON public.plan_addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subscription_addons_updated BEFORE UPDATE ON public.subscription_addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_account_entitlements_updated BEFORE UPDATE ON public.account_entitlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pools_updated BEFORE UPDATE ON public.pools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_strip_brands_updated BEFORE UPDATE ON public.strip_brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tests_updated BEFORE UPDATE ON public.tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_usage_periods_updated BEFORE UPDATE ON public.usage_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_account_member(p_account_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = p_account_id
      AND am.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.account_member_role(p_account_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT am.role
  FROM public.account_members am
  WHERE am.account_id = p_account_id
    AND am.user_id = p_user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_account_content(p_account_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.account_member_role(p_account_id, p_user_id), '') IN ('owner', 'admin', 'editor');
$$;

CREATE OR REPLACE FUNCTION public.refresh_usage_period(p_account_id uuid)
RETURNS public.usage_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_current_account_entitlements(p_account_id uuid)
RETURNS public.account_entitlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
  v_entitlements public.account_entitlements%ROWTYPE;
BEGIN
  v_usage := public.refresh_usage_period(p_account_id);

  SELECT *
  INTO v_entitlements
  FROM public.account_entitlements
  WHERE account_id = p_account_id
    AND period_start = v_usage.period_start
  LIMIT 1;

  RETURN v_entitlements;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_pool(p_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
BEGIN
  v_usage := public.refresh_usage_period(p_account_id);
  RETURN v_usage.pools_active_count < v_usage.pools_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_scan(p_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
BEGIN
  v_usage := public.refresh_usage_period(p_account_id);
  RETURN v_usage.scans_billable < v_usage.scans_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_scan_usage(p_account_id uuid, p_user_id uuid, p_test_id uuid)
RETURNS public.usage_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.ensure_account_for_user(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    INSERT INTO public.subscriptions (
      account_id,
      plan_id,
      provider,
      status,
      current_period_start,
      current_period_end
    )
    VALUES (
      v_account_id,
      'basic_monthly',
      'dev',
      'trialing',
      date_trunc('month', now()),
      date_trunc('month', now()) + interval '1 month'
    );
  END IF;

  PERFORM public.refresh_usage_period(v_account_id);
  RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_default_account()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_account_for_user(
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strip_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_image_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strip_brand_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles read own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "accounts members read" ON public.accounts FOR SELECT TO authenticated USING (public.is_account_member(id));
CREATE POLICY "accounts owner update" ON public.accounts FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "account members read own accounts" ON public.account_members
FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "account owners manage members" ON public.account_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_members.account_id
      AND a.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_members.account_id
      AND a.owner_user_id = auth.uid()
  )
);

CREATE POLICY "active plans readable" ON public.plans FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "active plan addons readable" ON public.plan_addons FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "subscriptions members read" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "subscription addons members read" ON public.subscription_addons FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "entitlements members read" ON public.account_entitlements FOR SELECT TO authenticated USING (public.is_account_member(account_id));

CREATE POLICY "pools members read" ON public.pools FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "pools managers insert" ON public.pools FOR INSERT TO authenticated WITH CHECK (
  public.can_manage_account_content(account_id)
  AND owner_user_id = auth.uid()
);
CREATE POLICY "pools managers update" ON public.pools FOR UPDATE TO authenticated
USING (public.can_manage_account_content(account_id))
WITH CHECK (public.can_manage_account_content(account_id));
CREATE POLICY "pools managers delete" ON public.pools FOR DELETE TO authenticated USING (public.can_manage_account_content(account_id));

CREATE POLICY "enabled strip brands readable" ON public.strip_brands FOR SELECT TO authenticated USING (is_enabled = true);

CREATE POLICY "tests members read" ON public.tests FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "tests account users insert" ON public.tests FOR INSERT TO authenticated WITH CHECK (
  public.is_account_member(account_id)
  AND (user_id IS NULL OR user_id = auth.uid())
);
CREATE POLICY "tests account users update" ON public.tests FOR UPDATE TO authenticated
USING (public.is_account_member(account_id))
WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "test readings members read" ON public.test_readings FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "test readings members write" ON public.test_readings FOR ALL TO authenticated
USING (public.is_account_member(account_id))
WITH CHECK (
  public.is_account_member(account_id)
  AND EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_readings.test_id
      AND t.account_id = test_readings.account_id
  )
);

CREATE POLICY "test recommendations members read" ON public.test_recommendations FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "test recommendations members write" ON public.test_recommendations FOR ALL TO authenticated
USING (public.is_account_member(account_id))
WITH CHECK (
  public.is_account_member(account_id)
  AND EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = test_recommendations.test_id
      AND t.account_id = test_recommendations.account_id
  )
);

CREATE POLICY "usage periods members read" ON public.usage_periods FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "usage events members read" ON public.usage_events FOR SELECT TO authenticated USING (public.is_account_member(account_id));

CREATE POLICY "scan image metadata members read" ON public.scan_image_metadata FOR SELECT TO authenticated USING (public.is_account_member(account_id));
CREATE POLICY "scan image metadata members write" ON public.scan_image_metadata FOR ALL TO authenticated
USING (public.is_account_member(account_id))
WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "brand requests insert" ON public.strip_brand_requests FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND (account_id IS NULL OR public.is_account_member(account_id))
);
CREATE POLICY "brand requests read own" ON public.strip_brand_requests FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR (account_id IS NOT NULL AND public.is_account_member(account_id))
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('scan-images', 'scan-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "users upload own scan images" ON storage.objects;
DROP POLICY IF EXISTS "users view own scan images" ON storage.objects;
DROP POLICY IF EXISTS "users update own scan images" ON storage.objects;
DROP POLICY IF EXISTS "users delete own scan images" ON storage.objects;
DROP POLICY IF EXISTS "admins view all scan images" ON storage.objects;
DROP POLICY IF EXISTS "admins delete all scan images" ON storage.objects;
DROP POLICY IF EXISTS "account members upload scan images" ON storage.objects;
DROP POLICY IF EXISTS "account members view scan images" ON storage.objects;
DROP POLICY IF EXISTS "account members update scan images" ON storage.objects;
DROP POLICY IF EXISTS "account members delete scan images" ON storage.objects;

CREATE POLICY "account members upload scan images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scan-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.can_manage_account_content(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "account members view scan images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scan-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.is_account_member(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "account members update scan images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'scan-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.can_manage_account_content(((storage.foldername(name))[2])::uuid)
)
WITH CHECK (
  bucket_id = 'scan-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.can_manage_account_content(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "account members delete scan images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'scan-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.can_manage_account_content(((storage.foldername(name))[2])::uuid)
);

GRANT EXECUTE ON FUNCTION public.ensure_default_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_account_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_pool(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_scan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_scan_usage(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_usage_period(uuid) TO authenticated;
