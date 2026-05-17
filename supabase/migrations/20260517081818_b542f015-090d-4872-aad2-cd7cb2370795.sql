
-- 1. Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
$$;

-- 3. RLS for user_roles
CREATE POLICY "users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins view all roles" ON public.user_roles
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. Auto-assign role on signup: first user = admin, rest = user
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 5. Admins can view all profiles, pools, tests
CREATE POLICY "admins view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "admins view all pools" ON public.pools
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "admins view all tests" ON public.tests
  FOR SELECT USING (public.is_admin(auth.uid()));

-- 6. Storage bucket for scan images (private)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('scan-images', 'scan-images', false)
  ON CONFLICT (id) DO NOTHING;

-- Users upload to their own folder
CREATE POLICY "users upload own scan images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'scan-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users view own scan images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'scan-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "admins view all scan images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'scan-images'
    AND public.is_admin(auth.uid())
  );
