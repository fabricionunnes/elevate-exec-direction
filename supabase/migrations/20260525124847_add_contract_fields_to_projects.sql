-- Add contract fields to onboarding_projects so each project has its own contract data
ALTER TABLE public.onboarding_projects
  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC,
  ADD COLUMN IF NOT EXISTS billing_day INTEGER CHECK (billing_day >= 1 AND billing_day <= 31),
  ADD COLUMN IF NOT EXISTS contract_notes TEXT;
