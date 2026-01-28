
-- Update is_onboarding_admin to also check for master role
CREATE OR REPLACE FUNCTION public.is_onboarding_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'master')
    AND is_active = true
  )
$$;

-- Update is_crm_admin to also check for master role
CREATE OR REPLACE FUNCTION public.is_crm_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'master', 'head_comercial')
  )
$$;

-- Update has_crm_access to also check for master role
CREATE OR REPLACE FUNCTION public.has_crm_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'master', 'head_comercial', 'closer', 'sdr')
  )
$$;
