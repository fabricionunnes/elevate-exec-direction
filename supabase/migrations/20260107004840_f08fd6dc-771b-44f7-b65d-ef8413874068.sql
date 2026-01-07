-- Add meeting_link column to onboarding_tasks
ALTER TABLE public.onboarding_tasks
ADD COLUMN meeting_link TEXT;

-- Add recording_link column to onboarding_meeting_notes
ALTER TABLE public.onboarding_meeting_notes
ADD COLUMN recording_link TEXT;