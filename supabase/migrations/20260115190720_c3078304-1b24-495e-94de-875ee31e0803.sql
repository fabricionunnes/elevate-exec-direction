-- Add RLS policies for staff to manage customer points tables

-- Policy for customer_points_rules - Staff can manage rules for companies they have access to
CREATE POLICY "Staff can manage company rules"
ON public.customer_points_rules
FOR ALL
USING (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);

-- Policy for customer_points_config - Staff can manage config
CREATE POLICY "Staff can manage company config"
ON public.customer_points_config
FOR ALL
USING (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);

-- Policy for customer_points_clients - Staff can manage clients
CREATE POLICY "Staff can manage company clients"
ON public.customer_points_clients
FOR ALL
USING (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);

-- Policy for customer_points_transactions - Staff can manage transactions
CREATE POLICY "Staff can manage company transactions"
ON public.customer_points_transactions
FOR ALL
USING (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);

-- Policy for customer_points_qr_campaigns - Staff can manage campaigns
CREATE POLICY "Staff can manage company campaigns"
ON public.customer_points_qr_campaigns
FOR ALL
USING (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);