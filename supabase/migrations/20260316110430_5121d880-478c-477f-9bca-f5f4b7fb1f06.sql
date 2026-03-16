ALTER TABLE public.onboarding_companies 
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_cpf TEXT,
  ADD COLUMN IF NOT EXISTS owner_rg TEXT,
  ADD COLUMN IF NOT EXISTS owner_marital_status TEXT;