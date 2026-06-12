ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pool-images', 'pool-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "account members upload pool images" ON storage.objects;
DROP POLICY IF EXISTS "account members view pool images" ON storage.objects;
DROP POLICY IF EXISTS "account members update pool images" ON storage.objects;
DROP POLICY IF EXISTS "account members delete pool images" ON storage.objects;

CREATE POLICY "account members upload pool images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pool-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.can_manage_account_content(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "account members view pool images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pool-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.is_account_member(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "account members update pool images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pool-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.can_manage_account_content(((storage.foldername(name))[2])::uuid)
)
WITH CHECK (
  bucket_id = 'pool-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.can_manage_account_content(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "account members delete pool images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pool-images'
  AND (storage.foldername(name))[1] = 'accounts'
  AND public.can_manage_account_content(((storage.foldername(name))[2])::uuid)
);
