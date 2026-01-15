-- Drop existing Staff policies and recreate with proper WITH CHECK for INSERT
DROP POLICY IF EXISTS "Staff can manage company rules" ON public.customer_points_rules;
DROP POLICY IF EXISTS "Staff can manage company config" ON public.customer_points_config;
DROP POLICY IF EXISTS "Staff can manage company clients" ON public.customer_points_clients;
DROP POLICY IF EXISTS "Staff can manage company transactions" ON public.customer_points_transactions;
DROP POLICY IF EXISTS "Staff can manage company campaigns" ON public.customer_points_qr_campaigns;

-- Recreate with both USING and WITH CHECK for ALL operations
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
)
WITH CHECK (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);

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
)
WITH CHECK (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);

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
)
WITH CHECK (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);

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
)
WITH CHECK (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);

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
)
WITH CHECK (
  company_id IN (
    SELECT DISTINCT op.onboarding_company_id
    FROM onboarding_projects op
    JOIN onboarding_staff os ON os.id = op.consultant_id OR os.id = op.cs_id
    WHERE os.user_id = auth.uid()
    AND op.onboarding_company_id IS NOT NULL
  )
);