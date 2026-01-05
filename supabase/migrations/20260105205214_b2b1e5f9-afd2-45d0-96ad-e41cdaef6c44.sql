-- Add per-channel sales tracking columns to CAC forms
ALTER TABLE public.onboarding_cac_forms
  ADD COLUMN IF NOT EXISTS facebook_sales_quantity integer,
  ADD COLUMN IF NOT EXISTS facebook_sales_value numeric,
  ADD COLUMN IF NOT EXISTS google_sales_quantity integer,
  ADD COLUMN IF NOT EXISTS google_sales_value numeric,
  ADD COLUMN IF NOT EXISTS linkedin_sales_quantity integer,
  ADD COLUMN IF NOT EXISTS linkedin_sales_value numeric;