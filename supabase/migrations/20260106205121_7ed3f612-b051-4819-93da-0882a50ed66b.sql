-- Drop the old check constraint
ALTER TABLE public.onboarding_staff DROP CONSTRAINT IF EXISTS onboarding_staff_role_check;

-- Add new check constraint with all roles including closer, sdr_ss, rh, marketing, financeiro
ALTER TABLE public.onboarding_staff ADD CONSTRAINT onboarding_staff_role_check 
CHECK (role IN ('admin', 'cs', 'consultant', 'closer', 'sdr_ss', 'rh', 'marketing', 'financeiro'));