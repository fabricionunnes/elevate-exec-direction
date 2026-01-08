-- Add payment method column to onboarding_companies
ALTER TABLE public.onboarding_companies 
ADD COLUMN payment_method TEXT DEFAULT NULL;

-- Add comment to describe the field
COMMENT ON COLUMN public.onboarding_companies.payment_method IS 'Payment method: card (credit card full payment) or monthly (recurring monthly payment)';