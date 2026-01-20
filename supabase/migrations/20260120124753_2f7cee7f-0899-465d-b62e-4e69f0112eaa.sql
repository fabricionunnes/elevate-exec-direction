
-- Drop the existing unique index that doesn't include team_id
DROP INDEX IF EXISTS kpi_monthly_targets_unique_idx;

-- Create a new unique index that includes team_id
CREATE UNIQUE INDEX kpi_monthly_targets_unique_idx ON public.kpi_monthly_targets 
USING btree (
  kpi_id, 
  month_year, 
  level_name, 
  COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(salesperson_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
