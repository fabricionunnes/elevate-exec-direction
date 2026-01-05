-- Add visibility field to onboarding_tasks
ALTER TABLE public.onboarding_tasks 
ADD COLUMN is_internal boolean NOT NULL DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.onboarding_tasks.is_internal IS 'When true, task is only visible to staff (CS, consultant, admin), not to clients';