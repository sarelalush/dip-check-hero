CREATE OR REPLACE FUNCTION public.admin_dashboard_scans(
  p_account_id uuid DEFAULT NULL,
  p_limit int DEFAULT 250
)
RETURNS TABLE (
  test_id uuid,
  account_id uuid,
  user_id uuid,
  email text,
  full_name text,
  pool_id uuid,
  pool_name text,
  strip_brand_id text,
  analysis_status text,
  overall_status text,
  provider text,
  model text,
  confidence numeric,
  low_confidence boolean,
  is_billable boolean,
  image_url text,
  image_path text,
  recommendation text,
  error_message text,
  readings jsonb,
  recommendations jsonb,
  analyzed_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_scans(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_scans(uuid, int) TO authenticated;
