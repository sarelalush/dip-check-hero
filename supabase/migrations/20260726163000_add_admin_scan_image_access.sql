DROP POLICY IF EXISTS "admins view scan images" ON storage.objects;

CREATE POLICY "admins view scan images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND public.is_current_user_admin()
  );
