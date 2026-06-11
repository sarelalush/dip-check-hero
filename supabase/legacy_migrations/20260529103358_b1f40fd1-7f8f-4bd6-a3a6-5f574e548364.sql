ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS tablets_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tablets_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tablet_weight_g integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS pump_hours_per_day numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS retest_hours numeric NOT NULL DEFAULT 6;