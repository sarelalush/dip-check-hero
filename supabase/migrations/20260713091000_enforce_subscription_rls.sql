-- Enforce subscription gates at the RLS layer too, not only in the app UI.

DROP POLICY IF EXISTS "pools managers insert" ON public.pools;
CREATE POLICY "pools managers insert" ON public.pools
FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_account_content(account_id)
  AND public.can_create_pool(account_id)
  AND owner_user_id = auth.uid()
);

DROP POLICY IF EXISTS "tests account users insert" ON public.tests;
CREATE POLICY "tests account users insert" ON public.tests
FOR INSERT TO authenticated
WITH CHECK (
  public.is_account_member(account_id)
  AND public.can_create_scan(account_id)
  AND (user_id IS NULL OR user_id = auth.uid())
);
