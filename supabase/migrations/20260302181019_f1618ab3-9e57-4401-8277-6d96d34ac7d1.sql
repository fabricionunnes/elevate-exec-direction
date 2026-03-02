ALTER TABLE public.onboarding_projects 
ADD COLUMN IF NOT EXISTS retention_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retention_notes TEXT DEFAULT NULL;