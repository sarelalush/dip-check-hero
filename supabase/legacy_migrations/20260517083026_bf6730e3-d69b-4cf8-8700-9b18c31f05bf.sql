
-- Helper: is the user among the first 20 signups and still within 30 days?
CREATE OR REPLACE FUNCTION public.is_early_bird_free(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT id, created_at
      FROM auth.users
      ORDER BY created_at ASC
      LIMIT 20
    ) early
    WHERE early.id = user_uuid
      AND early.created_at > now() - interval '30 days'
  );
$$;

-- Update has_active_subscription to include early-bird free access
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    public.is_early_bird_free(user_uuid)
    OR EXISTS (
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

-- Update allowed_pools_count so early-bird users get the base 1 pool
CREATE OR REPLACE FUNCTION public.allowed_pools_count(user_uuid uuid, check_env text DEFAULT 'live'::text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.is_early_bird_free(user_uuid) THEN 1
      ELSE 0
    END
    +
    COALESCE((
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
