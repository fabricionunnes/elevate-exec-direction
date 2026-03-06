
-- Helper function: check if client user has kpis_config permission for a given company
CREATE OR REPLACE FUNCTION public.client_has_kpis_config(check_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM onboarding_users ou
    JOIN onboarding_projects op ON op.id = ou.project_id
    LEFT JOIN client_user_permissions cup ON cup.user_id = ou.id AND cup.menu_key = 'kpis_config'
    LEFT JOIN project_menu_permissions pmp ON pmp.project_id = ou.project_id AND pmp.menu_key = 'kpis_config'
    WHERE ou.user_id = auth.uid()
    AND op.onboarding_company_id = check_company_id
    AND (
      ou.role IN ('client', 'gerente')
      OR cup.id IS NOT NULL
    )
    AND (pmp.id IS NOT NULL OR ou.role IN ('client', 'gerente'))
  )
$$;

-- company_units: allow clients with kpis_config to manage
CREATE POLICY "Clients with kpis_config can manage units"
ON public.company_units FOR ALL TO authenticated
USING (public.client_has_kpis_config(company_id))
WITH CHECK (public.client_has_kpis_config(company_id));

-- company_salespeople: allow clients with kpis_config to manage
CREATE POLICY "Clients with kpis_config can manage salespeople"
ON public.company_salespeople FOR ALL TO authenticated
USING (public.client_has_kpis_config(company_id))
WITH CHECK (public.client_has_kpis_config(company_id));

-- company_teams: allow clients with kpis_config to manage
CREATE POLICY "Clients with kpis_config can manage teams"
ON public.company_teams FOR ALL TO authenticated
USING (public.client_has_kpis_config(company_id))
WITH CHECK (public.client_has_kpis_config(company_id));

-- company_teams: clients need SELECT too
CREATE POLICY "Clients can view their company teams"
ON public.company_teams FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_users ou
    JOIN onboarding_projects op ON op.id = ou.project_id
    WHERE ou.user_id = auth.uid()
    AND op.onboarding_company_id = company_teams.company_id
  )
);

-- company_sectors: currently has permissive ALL with qual=true, so clients can already write.
-- But let's add client-specific management for safety
-- (company_sectors already has "Staff can manage sectors" with qual=true for ALL, so clients are covered)

-- company_sector_teams: allow clients with kpis_config
CREATE POLICY "Clients with kpis_config can manage sector teams"
ON public.company_sector_teams FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_sectors cs
    WHERE cs.id = company_sector_teams.sector_id
    AND public.client_has_kpis_config(cs.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_sectors cs
    WHERE cs.id = company_sector_teams.sector_id
    AND public.client_has_kpis_config(cs.company_id)
  )
);

-- company_sector_teams: clients need SELECT
CREATE POLICY "Clients can view sector teams"
ON public.company_sector_teams FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_sectors cs
    JOIN onboarding_users ou ON ou.user_id = auth.uid()
    JOIN onboarding_projects op ON op.id = ou.project_id
    WHERE cs.id = company_sector_teams.sector_id
    AND op.onboarding_company_id = cs.company_id
  )
);

-- company_kpis: allow clients with kpis_config to manage
CREATE POLICY "Clients with kpis_config can manage kpis"
ON public.company_kpis FOR ALL TO authenticated
USING (public.client_has_kpis_config(company_id))
WITH CHECK (public.client_has_kpis_config(company_id));

-- kpi_units, kpi_sectors, kpi_teams, kpi_salespeople: allow clients with kpis_config
CREATE POLICY "Clients with kpis_config can manage kpi_units"
ON public.kpi_units FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_kpis ck
    WHERE ck.id = kpi_units.kpi_id
    AND public.client_has_kpis_config(ck.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_kpis ck
    WHERE ck.id = kpi_units.kpi_id
    AND public.client_has_kpis_config(ck.company_id)
  )
);

CREATE POLICY "Clients with kpis_config can manage kpi_sectors"
ON public.kpi_sectors FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_kpis ck
    WHERE ck.id = kpi_sectors.kpi_id
    AND public.client_has_kpis_config(ck.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_kpis ck
    WHERE ck.id = kpi_sectors.kpi_id
    AND public.client_has_kpis_config(ck.company_id)
  )
);

CREATE POLICY "Clients with kpis_config can manage kpi_teams"
ON public.kpi_teams FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_kpis ck
    WHERE ck.id = kpi_teams.kpi_id
    AND public.client_has_kpis_config(ck.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_kpis ck
    WHERE ck.id = kpi_teams.kpi_id
    AND public.client_has_kpis_config(ck.company_id)
  )
);

CREATE POLICY "Clients with kpis_config can manage kpi_salespeople"
ON public.kpi_salespeople FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_kpis ck
    WHERE ck.id = kpi_salespeople.kpi_id
    AND public.client_has_kpis_config(ck.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_kpis ck
    WHERE ck.id = kpi_salespeople.kpi_id
    AND public.client_has_kpis_config(ck.company_id)
  )
);
