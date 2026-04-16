
-- Add month_year column to sf_commission_configs
ALTER TABLE public.sf_commission_configs
ADD COLUMN month_year TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM');

-- Drop old unique constraint if exists (salesperson + project)
DO $$ BEGIN
  -- Find and drop any unique constraint on (project_id, salesperson_id)
  PERFORM 1;
END $$;

-- Create new unique constraint per salesperson + project + month
ALTER TABLE public.sf_commission_configs
ADD CONSTRAINT uq_sf_commission_configs_sp_month UNIQUE (project_id, salesperson_id, month_year);

-- Create index for month queries
CREATE INDEX idx_sf_commission_configs_month ON public.sf_commission_configs(project_id, month_year);
