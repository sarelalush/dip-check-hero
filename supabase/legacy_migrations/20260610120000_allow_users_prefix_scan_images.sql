-- Mobile uploads scan images to users/{user_id}/tests/{test_id}/scan.jpg.
-- Older policies expected {user_id}/... at the bucket root. Keep both shapes
-- valid so existing objects and the native mobile path work in fresh projects.

DROP POLICY IF EXISTS "users upload own scan images" ON storage.objects;
DROP POLICY IF EXISTS "users view own scan images" ON storage.objects;
DROP POLICY IF EXISTS "users update own scan images" ON storage.objects;
DROP POLICY IF EXISTS "users delete own scan images" ON storage.objects;

CREATE POLICY "users upload own scan images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scan-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'users'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);

CREATE POLICY "users view own scan images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scan-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'users'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);

CREATE POLICY "users update own scan images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'scan-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'users'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
)
WITH CHECK (
  bucket_id = 'scan-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'users'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);

CREATE POLICY "users delete own scan images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'scan-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'users'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);
