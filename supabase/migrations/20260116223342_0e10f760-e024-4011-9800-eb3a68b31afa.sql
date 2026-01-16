-- Add is_simulator flag to companies
ALTER TABLE public.onboarding_companies
ADD COLUMN is_simulator BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.onboarding_companies.is_simulator IS 'When true, this company and its projects are excluded from all metrics calculations (NPS, Churn, Health Score, Goals, etc.)';