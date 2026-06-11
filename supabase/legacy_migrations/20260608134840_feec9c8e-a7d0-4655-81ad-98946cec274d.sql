REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_pool_last_test() FROM PUBLIC, anon, authenticated;

CREATE POLICY "admins view all brand requests"
ON public.strip_brand_requests
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "users delete own scan images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'scan-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "admins delete all scan images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'scan-images'
  AND public.is_admin(auth.uid())
);