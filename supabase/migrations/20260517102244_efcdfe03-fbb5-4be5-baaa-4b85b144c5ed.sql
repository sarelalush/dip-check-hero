-- Allow admins to manage subscriptions table (grants/revokes paid access)
CREATE POLICY "admins manage subscriptions"
ON public.subscriptions
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));