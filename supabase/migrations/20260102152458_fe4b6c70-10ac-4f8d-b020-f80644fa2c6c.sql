-- Remove the check constraint on onboarding_staff role to allow 'admin'
ALTER TABLE onboarding_staff DROP CONSTRAINT IF EXISTS onboarding_staff_role_check;

-- Add new constraint that includes admin
ALTER TABLE onboarding_staff ADD CONSTRAINT onboarding_staff_role_check 
CHECK (role IN ('cs', 'consultant', 'admin'));