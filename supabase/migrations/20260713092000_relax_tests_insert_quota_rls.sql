-- Test rows may be created before usage is registered, so do not put the
-- scan quota check inside the INSERT policy. The scan flow itself is gated by
-- can_create_scan before analysis.

DROP POLICY IF EXISTS "tests account users insert" ON public.tests;
CREATE POLICY "tests account users insert" ON public.tests
FOR INSERT TO authenticated
WITH CHECK (
  public.is_account_member(account_id)
  AND public.account_has_active_subscription(account_id)
  AND (user_id IS NULL OR user_id = auth.uid())
);
