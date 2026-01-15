-- Drop and recreate policies to also check onboarding_companies consultant_id/cs_id
DROP POLICY IF EXISTS "Staff can manage company rules" ON public.customer_points_rules;
DROP POLICY IF EXISTS "Staff can manage company config" ON public.customer_points_config;
DROP POLICY IF EXISTS "Staff can manage company clients" ON public.customer_points_clients;
DROP POLICY IF EXISTS "Staff can manage company transactions" ON public.customer_points_transactions;
DROP POLICY IF EXISTS "Staff can manage company campaigns" ON public.customer_points_qr_campaigns;

-- Create function to check if staff has access to a company
CREATE OR REPLACE FUNCTION public.staff_has_company_access(check_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND (
      -- Staff is assigned to the company directly
      EXISTS (
        SELECT 1 FROM onboarding_companies oc
        WHERE oc.id = check_company_id
        AND (oc.consultant_id = os.id OR oc.cs_id = os.id)
      )
      OR
      -- Staff is assigned to a project of this company
      EXISTS (
        SELECT 1 FROM onboarding_projects op
        WHERE op.onboarding_company_id = check_company_id
        AND (op.consultant_id = os.id OR op.cs_id = os.id)
      )
      OR
      -- Staff is admin
      os.role = 'admin'
    )
  )
$$;

-- Recreate policies using the function
CREATE POLICY "Staff can manage company rules"
ON public.customer_points_rules
FOR ALL
USING (public.staff_has_company_access(company_id))
WITH CHECK (public.staff_has_company_access(company_id));

CREATE POLICY "Staff can manage company config"
ON public.customer_points_config
FOR ALL
USING (public.staff_has_company_access(company_id))
WITH CHECK (public.staff_has_company_access(company_id));

CREATE POLICY "Staff can manage company clients"
ON public.customer_points_clients
FOR ALL
USING (public.staff_has_company_access(company_id))
WITH CHECK (public.staff_has_company_access(company_id));

CREATE POLICY "Staff can manage company transactions"
ON public.customer_points_transactions
FOR ALL
USING (public.staff_has_company_access(company_id))
WITH CHECK (public.staff_has_company_access(company_id));

CREATE POLICY "Staff can manage company campaigns"
ON public.customer_points_qr_campaigns
FOR ALL
USING (public.staff_has_company_access(company_id))
WITH CHECK (public.staff_has_company_access(company_id));