CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text DEFAULT 'live'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
    AND environment = check_env
    AND product_id = 'pool_base_plan'
    AND (
      (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > now()))
      OR (status = 'canceled' AND current_period_end > now())
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.allowed_pools_count(user_uuid uuid, check_env text DEFAULT 'live')
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT 1 + COALESCE(SUM(quantity), 0)::integer
    FROM public.subscriptions
    WHERE user_id = user_uuid
    AND environment = check_env
    AND product_id = 'pool_extra_addon'
    AND (
      (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > now()))
      OR (status = 'canceled' AND current_period_end > now())
    )
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s2
      WHERE s2.user_id = user_uuid
      AND s2.environment = check_env
      AND s2.product_id = 'pool_base_plan'
      AND (
        (s2.status IN ('active', 'trialing') AND (s2.current_period_end IS NULL OR s2.current_period_end > now()))
        OR (s2.status = 'canceled' AND s2.current_period_end > now())
      )
    )
  ), 0);
$$;