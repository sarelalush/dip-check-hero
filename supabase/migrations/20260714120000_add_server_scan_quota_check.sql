CREATE OR REPLACE FUNCTION public.account_has_active_subscription_for_user(
  p_account_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.account_has_active_subscription_for_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_has_active_subscription_for_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.account_has_active_subscription_for_user(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.can_create_scan_for_user(
  p_account_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage public.usage_periods%ROWTYPE;
BEGIN
  IF NOT public.account_has_active_subscription_for_user(p_account_id, p_user_id) THEN
    RETURN false;
  END IF;

  v_usage := public.refresh_usage_period(p_account_id);
  RETURN v_usage.scans_billable < v_usage.scans_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.can_create_scan_for_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_scan_for_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_scan_for_user(uuid, uuid) TO service_role;
