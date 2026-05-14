DROP POLICY IF EXISTS "anyone can submit brand request" ON public.strip_brand_requests;

ALTER TABLE public.strip_brand_requests
  ADD CONSTRAINT strip_brand_requests_brand_name_len
  CHECK (char_length(brand_name) BETWEEN 1 AND 120);

ALTER TABLE public.strip_brand_requests
  ADD CONSTRAINT strip_brand_requests_notes_len
  CHECK (notes IS NULL OR char_length(notes) <= 1000);

CREATE POLICY "submit brand request as self or guest"
  ON public.strip_brand_requests
  FOR INSERT
  TO public
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);