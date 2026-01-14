-- Create sectors table (setores dentro de unidades)
CREATE TABLE public.company_sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.company_units(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create junction table for salespeople <-> sectors (many-to-many)
CREATE TABLE public.salesperson_sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salesperson_id UUID NOT NULL REFERENCES public.company_salespeople(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.company_sectors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(salesperson_id, sector_id)
);

-- Add sector_id to company_kpis (KPIs can be linked to a sector)
ALTER TABLE public.company_kpis 
ADD COLUMN sector_id UUID REFERENCES public.company_sectors(id) ON DELETE SET NULL;

-- Add sector_id to kpi_entries (entries can be linked to a sector)
ALTER TABLE public.kpi_entries 
ADD COLUMN sector_id UUID REFERENCES public.company_sectors(id) ON DELETE SET NULL;

-- Add sector_id to kpi_monthly_targets (monthly targets per sector)
ALTER TABLE public.kpi_monthly_targets 
ADD COLUMN sector_id UUID REFERENCES public.company_sectors(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.company_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesperson_sectors ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_sectors
CREATE POLICY "Staff can manage sectors"
ON public.company_sectors
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can read sectors"
ON public.company_sectors
FOR SELECT
USING (true);

-- RLS policies for salesperson_sectors
CREATE POLICY "Staff can manage salesperson_sectors"
ON public.salesperson_sectors
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can read salesperson_sectors"
ON public.salesperson_sectors
FOR SELECT
USING (true);

-- Create indexes for performance
CREATE INDEX idx_company_sectors_company ON public.company_sectors(company_id);
CREATE INDEX idx_company_sectors_unit ON public.company_sectors(unit_id);
CREATE INDEX idx_salesperson_sectors_salesperson ON public.salesperson_sectors(salesperson_id);
CREATE INDEX idx_salesperson_sectors_sector ON public.salesperson_sectors(sector_id);
CREATE INDEX idx_company_kpis_sector ON public.company_kpis(sector_id);
CREATE INDEX idx_kpi_entries_sector ON public.kpi_entries(sector_id);
CREATE INDEX idx_kpi_monthly_targets_sector ON public.kpi_monthly_targets(sector_id);

-- Trigger for updated_at
CREATE TRIGGER update_company_sectors_updated_at
BEFORE UPDATE ON public.company_sectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();