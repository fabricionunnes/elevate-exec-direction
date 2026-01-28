
-- Add public read policies for KPI junction tables used in public KPI entry form
-- This allows salespeople to access the entry form without being logged in

-- Public SELECT policy for kpi_units
CREATE POLICY "Public can view kpi_units"
ON public.kpi_units
FOR SELECT
TO anon, authenticated
USING (true);

-- Public SELECT policy for kpi_sectors
CREATE POLICY "Public can view kpi_sectors"
ON public.kpi_sectors
FOR SELECT
TO anon, authenticated
USING (true);

-- Public SELECT policy for kpi_teams
CREATE POLICY "Public can view kpi_teams"
ON public.kpi_teams
FOR SELECT
TO anon, authenticated
USING (true);

-- Public SELECT policy for kpi_salespeople
CREATE POLICY "Public can view kpi_salespeople"
ON public.kpi_salespeople
FOR SELECT
TO anon, authenticated
USING (true);
