-- Helper to check staff role from onboarding_staff
CREATE OR REPLACE FUNCTION public.is_commercial_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_staff
    WHERE user_id = _user_id
      AND role IN ('master', 'admin', 'head_comercial')
  )
$$;

CREATE TABLE public.diagnostic_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT NOT NULL,
  website TEXT,
  role TEXT,
  monthly_revenue TEXT,
  team_size TEXT,
  product_interest TEXT,
  main_challenge TEXT NOT NULL,
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT
);

ALTER TABLE public.diagnostic_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit diagnostic application"
ON public.diagnostic_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Commercial staff can view diagnostic applications"
ON public.diagnostic_applications
FOR SELECT
TO authenticated
USING (public.is_commercial_staff(auth.uid()));

CREATE POLICY "Commercial staff can update diagnostic applications"
ON public.diagnostic_applications
FOR UPDATE
TO authenticated
USING (public.is_commercial_staff(auth.uid()));

CREATE POLICY "Commercial staff can delete diagnostic applications"
ON public.diagnostic_applications
FOR DELETE
TO authenticated
USING (public.is_commercial_staff(auth.uid()));

CREATE TRIGGER update_diagnostic_applications_updated_at
BEFORE UPDATE ON public.diagnostic_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_diagnostic_applications_created_at ON public.diagnostic_applications(created_at DESC);
CREATE INDEX idx_diagnostic_applications_status ON public.diagnostic_applications(status);