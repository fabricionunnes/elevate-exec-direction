
-- Drop existing client policies that don't have WITH CHECK for mutations
DROP POLICY IF EXISTS "Users can manage their company rules" ON public.customer_points_rules;
DROP POLICY IF EXISTS "Users can view their company rules" ON public.customer_points_rules;
DROP POLICY IF EXISTS "Users can manage their company config" ON public.customer_points_config;
DROP POLICY IF EXISTS "Users can view their company config" ON public.customer_points_config;
DROP POLICY IF EXISTS "Users can manage their company clients" ON public.customer_points_clients;
DROP POLICY IF EXISTS "Users can view their company clients" ON public.customer_points_clients;
DROP POLICY IF EXISTS "Users can manage their company transactions" ON public.customer_points_transactions;
DROP POLICY IF EXISTS "Users can view their company transactions" ON public.customer_points_transactions;
DROP POLICY IF EXISTS "Users can manage their company campaigns" ON public.customer_points_qr_campaigns;
DROP POLICY IF EXISTS "Users can view their company campaigns" ON public.customer_points_qr_campaigns;

-- Create a helper function to check if a client user has access to a company
CREATE OR REPLACE FUNCTION public.client_has_company_access(check_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM onboarding_users ou
    JOIN onboarding_projects op ON op.id = ou.project_id
    WHERE ou.user_id = auth.uid()
    AND (op.company_id = check_company_id OR op.onboarding_company_id = check_company_id)
  );
$$;

-- Recreate client policies with proper WITH CHECK clauses for all tables

-- customer_points_rules
CREATE POLICY "Clients can manage their company rules"
ON public.customer_points_rules
FOR ALL
USING (public.client_has_company_access(company_id))
WITH CHECK (public.client_has_company_access(company_id));

-- customer_points_config
CREATE POLICY "Clients can manage their company config"
ON public.customer_points_config
FOR ALL
USING (public.client_has_company_access(company_id))
WITH CHECK (public.client_has_company_access(company_id));

-- customer_points_clients
CREATE POLICY "Clients can manage their company clients"
ON public.customer_points_clients
FOR ALL
USING (public.client_has_company_access(company_id))
WITH CHECK (public.client_has_company_access(company_id));

-- customer_points_transactions
CREATE POLICY "Clients can manage their company transactions"
ON public.customer_points_transactions
FOR ALL
USING (public.client_has_company_access(company_id))
WITH CHECK (public.client_has_company_access(company_id));

-- customer_points_qr_campaigns
CREATE POLICY "Clients can manage their company campaigns"
ON public.customer_points_qr_campaigns
FOR ALL
USING (public.client_has_company_access(company_id))
WITH CHECK (public.client_has_company_access(company_id));
