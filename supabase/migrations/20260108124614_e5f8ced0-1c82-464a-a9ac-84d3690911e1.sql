-- Create table for monthly KPI targets
CREATE TABLE public.kpi_monthly_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id UUID NOT NULL REFERENCES public.company_kpis(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL, -- Format: YYYY-MM (e.g., "2026-01")
  target_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(kpi_id, month_year)
);

-- Enable RLS
ALTER TABLE public.kpi_monthly_targets ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow all operations for authenticated users (similar to company_kpis)
CREATE POLICY "Allow read kpi_monthly_targets" 
ON public.kpi_monthly_targets 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert kpi_monthly_targets" 
ON public.kpi_monthly_targets 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update kpi_monthly_targets" 
ON public.kpi_monthly_targets 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete kpi_monthly_targets" 
ON public.kpi_monthly_targets 
FOR DELETE 
USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_kpi_monthly_targets_updated_at
BEFORE UPDATE ON public.kpi_monthly_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_kpi_monthly_targets_kpi_month ON public.kpi_monthly_targets(kpi_id, month_year);
CREATE INDEX idx_kpi_monthly_targets_company_month ON public.kpi_monthly_targets(company_id, month_year);