-- Create function to check if user can view ALL CRM leads (not just their own)
CREATE OR REPLACE FUNCTION public.can_view_all_crm_leads()
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
    AND role IN ('admin', 'master', 'head_comercial', 'sdr')
  )
$$;

-- Drop the restrictive policy for viewing own leads
DROP POLICY IF EXISTS "CRM users can view own leads" ON public.crm_leads;

-- Create new policy that allows certain roles to view ALL leads
CREATE POLICY "CRM users can view leads"
ON public.crm_leads
FOR SELECT
USING (
  is_crm_admin() 
  OR can_view_all_crm_leads()
  OR (has_crm_access() AND owner_staff_id = get_current_staff_id())
);

-- Drop the old admin view policy since it's now covered
DROP POLICY IF EXISTS "CRM admins can view all leads" ON public.crm_leads;

-- Also update the UPDATE policy to allow these roles to update all leads
DROP POLICY IF EXISTS "CRM users can update own leads" ON public.crm_leads;
DROP POLICY IF EXISTS "CRM admins can update all leads" ON public.crm_leads;

CREATE POLICY "CRM users can update leads"
ON public.crm_leads
FOR UPDATE
USING (
  is_crm_admin() 
  OR can_view_all_crm_leads()
  OR (has_crm_access() AND owner_staff_id = get_current_staff_id())
);