CREATE TABLE public.strip_brand_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  brand_name TEXT NOT NULL,
  notes TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.strip_brand_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests) can submit a request
CREATE POLICY "anyone can submit brand request"
  ON public.strip_brand_requests
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Users can view their own submitted requests
CREATE POLICY "users view own brand requests"
  ON public.strip_brand_requests
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);