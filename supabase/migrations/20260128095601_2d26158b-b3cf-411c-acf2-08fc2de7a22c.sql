
-- First, drop the existing check constraint
ALTER TABLE public.onboarding_staff DROP CONSTRAINT IF EXISTS onboarding_staff_role_check;

-- Add new check constraint that includes all existing roles + master
ALTER TABLE public.onboarding_staff ADD CONSTRAINT onboarding_staff_role_check 
CHECK (role IN ('admin', 'cs', 'consultant', 'master', 'head_comercial', 'closer', 'sdr', 'rh', 'financeiro', 'marketing'));
