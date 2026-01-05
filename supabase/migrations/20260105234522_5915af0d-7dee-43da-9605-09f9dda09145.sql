-- Add is_internal column to task templates
ALTER TABLE public.onboarding_task_templates 
ADD COLUMN is_internal boolean NOT NULL DEFAULT false;