-- Add unit_id and salesperson_id columns to kpi_monthly_targets for granular targets
ALTER TABLE public.kpi_monthly_targets 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.company_units(id) ON DELETE CASCADE;

ALTER TABLE public.kpi_monthly_targets 
ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES public.company_salespeople(id) ON DELETE CASCADE;

-- Drop existing unique constraint
ALTER TABLE public.kpi_monthly_targets 
DROP CONSTRAINT IF EXISTS kpi_monthly_targets_kpi_month_level_key;

-- Create new unique constraint including unit and salesperson
-- Use COALESCE with empty UUID to handle nulls in unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS kpi_monthly_targets_unique_idx 
ON public.kpi_monthly_targets (
  kpi_id, 
  month_year, 
  level_name, 
  COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(salesperson_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Add comment for documentation
COMMENT ON COLUMN public.kpi_monthly_targets.unit_id IS 'If set, this target applies only to this unit. NULL means company-wide.';
COMMENT ON COLUMN public.kpi_monthly_targets.salesperson_id IS 'If set, this target applies only to this salesperson. NULL means all salespeople.';