-- Add reactivated_at field to track when a project was reactivated from cancellation
ALTER TABLE public.onboarding_projects 
ADD COLUMN reactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.onboarding_projects.reactivated_at IS 'Timestamp when project was reactivated from cancellation_signaled or notice_period status';