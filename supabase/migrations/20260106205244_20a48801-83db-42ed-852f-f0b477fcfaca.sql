-- Drop the old check constraint
ALTER TABLE public.onboarding_staff DROP CONSTRAINT IF EXISTS onboarding_staff_role_check;

-- Add new check constraint with sdr instead of sdr_ss to match frontend
ALTER TABLE public.onboarding_staff ADD CONSTRAINT onboarding_staff_role_check 
CHECK (role IN ('admin', 'cs', 'consultant', 'closer', 'sdr', 'rh', 'marketing', 'financeiro'));