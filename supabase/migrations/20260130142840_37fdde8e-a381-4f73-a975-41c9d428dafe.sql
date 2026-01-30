-- Fix RLS policies for CRM origins to match CRM access model
-- (Admins manage; CRM access can view)

ALTER TABLE public.crm_origins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and head can manage origins" ON public.crm_origins;
DROP POLICY IF EXISTS "Staff can view origins" ON public.crm_origins;

-- Allow CRM admins to fully manage origins
CREATE POLICY "CRM admins can manage origins"
ON public.crm_origins
FOR ALL
TO authenticated
USING (public.is_crm_admin())
WITH CHECK (public.is_crm_admin());

-- Allow CRM users with access to view origins
CREATE POLICY "CRM users can view origins"
ON public.crm_origins
FOR SELECT
TO authenticated
USING (public.has_crm_access());
