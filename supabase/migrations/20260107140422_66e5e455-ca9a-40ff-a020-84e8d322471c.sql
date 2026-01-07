-- Add policies for authenticated client users to view KPIs, salespeople and entries
-- based on their project's company association

-- Policy for company_kpis: clients can view KPIs of their company
CREATE POLICY "Clients can view their company kpis"
ON public.company_kpis
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM onboarding_users ou
    JOIN onboarding_projects op ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid() 
    AND op.onboarding_company_id = company_kpis.company_id
  )
);

-- Policy for company_salespeople: clients can view salespeople of their company
CREATE POLICY "Clients can view their company salespeople"
ON public.company_salespeople
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM onboarding_users ou
    JOIN onboarding_projects op ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid() 
    AND op.onboarding_company_id = company_salespeople.company_id
  )
);

-- Policy for kpi_entries: clients can view entries of their company
CREATE POLICY "Clients can view their company kpi entries"
ON public.kpi_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM onboarding_users ou
    JOIN onboarding_projects op ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid() 
    AND op.onboarding_company_id = kpi_entries.company_id
  )
);