-- Add scope columns to company_kpis for defining KPI scope (company, sector, team, or salesperson)
-- scope: 'company' (default), 'sector', 'team', 'salesperson'
ALTER TABLE public.company_kpis 
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'company',
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.company_teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES public.company_salespeople(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.company_units(id) ON DELETE SET NULL;

-- Update existing KPIs: if they have sector_id, set scope to 'sector'; otherwise 'company'
UPDATE public.company_kpis 
SET scope = CASE 
  WHEN sector_id IS NOT NULL THEN 'sector'
  ELSE 'company'
END
WHERE scope IS NULL OR scope = 'company';

-- Add comments to document the schema
COMMENT ON COLUMN public.company_kpis.scope IS 'Defines the KPI scope: company, sector, team, or salesperson';
COMMENT ON COLUMN public.company_kpis.team_id IS 'If scope is team, this is the team the KPI applies to';
COMMENT ON COLUMN public.company_kpis.salesperson_id IS 'If scope is salesperson, this is the specific salesperson';
COMMENT ON COLUMN public.company_kpis.unit_id IS 'Optional unit filter for the KPI';