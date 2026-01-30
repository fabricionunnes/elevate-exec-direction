-- Fix RLS policies for CRM origin groups to match CRM access model

ALTER TABLE public.crm_origin_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and head can manage origin groups" ON public.crm_origin_groups;
DROP POLICY IF EXISTS "Staff can view origin groups" ON public.crm_origin_groups;

-- Allow CRM admins to fully manage origin groups
CREATE POLICY "CRM admins can manage origin groups"
ON public.crm_origin_groups
FOR ALL
TO authenticated
USING (public.is_crm_admin())
WITH CHECK (public.is_crm_admin());

-- Allow CRM users with access to view origin groups
CREATE POLICY "CRM users can view origin groups"
ON public.crm_origin_groups
FOR SELECT
TO authenticated
USING (public.has_crm_access());