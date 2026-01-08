-- Add renewal status field to contract renewals table
ALTER TABLE public.onboarding_contract_renewals 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'renovado';

-- Add previous start date to track full contract history
ALTER TABLE public.onboarding_contract_renewals 
ADD COLUMN IF NOT EXISTS previous_start_date date;

-- Add new start date
ALTER TABLE public.onboarding_contract_renewals 
ADD COLUMN IF NOT EXISTS new_start_date date;

-- Create index for faster queries by company and date
CREATE INDEX IF NOT EXISTS idx_contract_renewals_company_date 
ON public.onboarding_contract_renewals(company_id, renewal_date DESC);