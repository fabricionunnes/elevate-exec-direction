-- Add CRM and Documents links to projects
ALTER TABLE public.onboarding_projects
ADD COLUMN IF NOT EXISTS crm_link TEXT,
ADD COLUMN IF NOT EXISTS documents_link TEXT;