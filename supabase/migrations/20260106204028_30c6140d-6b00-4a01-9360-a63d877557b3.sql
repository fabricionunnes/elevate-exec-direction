-- Add renewal tracking fields to onboarding_companies
ALTER TABLE public.onboarding_companies
ADD COLUMN IF NOT EXISTS renewal_plan_type TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS renewal_status TEXT DEFAULT 'em_negociacao',
ADD COLUMN IF NOT EXISTS renewal_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.onboarding_companies.renewal_plan_type IS 'Tipo de plano: monthly, quarterly, semiannual, annual';
COMMENT ON COLUMN public.onboarding_companies.renewal_status IS 'Status: renovado, encerrado, em_negociacao, vai_renovar, falta_pagar';
COMMENT ON COLUMN public.onboarding_companies.renewal_notes IS 'Observações sobre a negociação';