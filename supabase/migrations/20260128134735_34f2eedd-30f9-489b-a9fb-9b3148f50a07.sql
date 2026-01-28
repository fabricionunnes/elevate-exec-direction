-- Create junction tables for KPI multi-select relationships

-- KPI to Units (many-to-many)
CREATE TABLE IF NOT EXISTS public.kpi_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id UUID NOT NULL REFERENCES public.company_kpis(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.company_units(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(kpi_id, unit_id)
);

-- KPI to Sectors (many-to-many)
CREATE TABLE IF NOT EXISTS public.kpi_sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id UUID NOT NULL REFERENCES public.company_kpis(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.company_sectors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(kpi_id, sector_id)
);

-- KPI to Teams (many-to-many)
CREATE TABLE IF NOT EXISTS public.kpi_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id UUID NOT NULL REFERENCES public.company_kpis(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.company_teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(kpi_id, team_id)
);

-- KPI to Salespeople (many-to-many)
CREATE TABLE IF NOT EXISTS public.kpi_salespeople (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id UUID NOT NULL REFERENCES public.company_kpis(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES public.company_salespeople(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(kpi_id, salesperson_id)
);

-- Enable RLS
ALTER TABLE public.kpi_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_salespeople ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow staff to manage
CREATE POLICY "Staff can view kpi_units" ON public.kpi_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert kpi_units" ON public.kpi_units FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can delete kpi_units" ON public.kpi_units FOR DELETE TO authenticated USING (true);

CREATE POLICY "Staff can view kpi_sectors" ON public.kpi_sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert kpi_sectors" ON public.kpi_sectors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can delete kpi_sectors" ON public.kpi_sectors FOR DELETE TO authenticated USING (true);

CREATE POLICY "Staff can view kpi_teams" ON public.kpi_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert kpi_teams" ON public.kpi_teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can delete kpi_teams" ON public.kpi_teams FOR DELETE TO authenticated USING (true);

CREATE POLICY "Staff can view kpi_salespeople" ON public.kpi_salespeople FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert kpi_salespeople" ON public.kpi_salespeople FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can delete kpi_salespeople" ON public.kpi_salespeople FOR DELETE TO authenticated USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kpi_units_kpi ON public.kpi_units(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_units_unit ON public.kpi_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_kpi_sectors_kpi ON public.kpi_sectors(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_sectors_sector ON public.kpi_sectors(sector_id);
CREATE INDEX IF NOT EXISTS idx_kpi_teams_kpi ON public.kpi_teams(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_teams_team ON public.kpi_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_kpi_salespeople_kpi ON public.kpi_salespeople(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_salespeople_salesperson ON public.kpi_salespeople(salesperson_id);