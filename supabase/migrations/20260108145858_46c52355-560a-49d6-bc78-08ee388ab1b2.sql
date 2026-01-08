-- Add CRM login and password fields to onboarding_projects
ALTER TABLE public.onboarding_projects 
ADD COLUMN crm_login TEXT DEFAULT NULL,
ADD COLUMN crm_password TEXT DEFAULT NULL;