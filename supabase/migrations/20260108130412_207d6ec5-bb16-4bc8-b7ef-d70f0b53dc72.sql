-- Add level_name column to kpi_monthly_targets for multiple named targets
ALTER TABLE public.kpi_monthly_targets 
ADD COLUMN IF NOT EXISTS level_name TEXT NOT NULL DEFAULT 'Meta';

-- Add sort_order for ordering target levels
ALTER TABLE public.kpi_monthly_targets 
ADD COLUMN IF NOT EXISTS level_order INTEGER NOT NULL DEFAULT 1;

-- Drop existing unique constraint if it exists
ALTER TABLE public.kpi_monthly_targets 
DROP CONSTRAINT IF EXISTS kpi_monthly_targets_kpi_id_month_year_key;

-- Create new unique constraint including level_name
ALTER TABLE public.kpi_monthly_targets 
ADD CONSTRAINT kpi_monthly_targets_kpi_month_level_key 
UNIQUE (kpi_id, month_year, level_name);

-- Create a table to store company-wide target level templates
CREATE TABLE IF NOT EXISTS public.kpi_target_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

-- Enable RLS
ALTER TABLE public.kpi_target_levels ENABLE ROW LEVEL SECURITY;

-- Create policies for kpi_target_levels
CREATE POLICY "Staff can manage target levels" ON public.kpi_target_levels
FOR ALL USING (true) WITH CHECK (true);

-- Insert default target levels for existing companies that have KPIs
INSERT INTO public.kpi_target_levels (company_id, name, sort_order)
SELECT DISTINCT c.id, 'Meta', 1
FROM public.onboarding_companies c
WHERE EXISTS (SELECT 1 FROM public.company_kpis k WHERE k.company_id = c.id)
AND NOT EXISTS (SELECT 1 FROM public.kpi_target_levels t WHERE t.company_id = c.id AND t.name = 'Meta')
ON CONFLICT (company_id, name) DO NOTHING;