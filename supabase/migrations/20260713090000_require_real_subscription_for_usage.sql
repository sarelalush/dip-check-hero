-- Require a real paid/trial subscription before pool creation or scan usage.
-- New accounts should not receive an automatic dev subscription.

CREATE OR REPLACE FUNCTION public.account_has_active_subscription(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.account_has_active_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_has_active_subscription(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_create_pool(p_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
BEGIN
  IF NOT public.account_has_active_subscription(p_account_id) THEN
    RETURN false;
  END IF;

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
  IF NOT public.account_has_active_subscription(p_account_id) THEN
    RETURN false;
  END IF;

  v_usage := public.refresh_usage_period(p_account_id);
  RETURN v_usage.scans_billable < v_usage.scans_limit;
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
  END IF;

  PERFORM public.refresh_usage_period(v_account_id);
  RETURN v_account_id;
END;
$$;

UPDATE public.subscriptions
SET
  cancel_at_period_end = true,
  current_period_end = LEAST(COALESCE(current_period_end, now()), now()),
  status = 'canceled',
  updated_at = now()
WHERE provider = 'dev'
  AND status IN ('trialing', 'active', 'past_due');

REVOKE ALL ON FUNCTION public.can_create_pool(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_create_scan(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_account_for_user(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_pool(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_scan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_account_for_user(uuid, text, text, text) TO authenticated;
