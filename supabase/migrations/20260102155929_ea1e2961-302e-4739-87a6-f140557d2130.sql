-- Add recurrence field to task templates and tasks
ALTER TABLE public.onboarding_task_templates 
ADD COLUMN recurrence text DEFAULT NULL;

ALTER TABLE public.onboarding_tasks 
ADD COLUMN recurrence text DEFAULT NULL;

-- Add template_id to track which template a task came from (for recurring tasks)
ALTER TABLE public.onboarding_tasks 
ADD COLUMN template_id uuid REFERENCES public.onboarding_task_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.onboarding_task_templates.recurrence IS 'Recurrence pattern: daily, weekly, monthly, or null for one-time tasks';
COMMENT ON COLUMN public.onboarding_tasks.recurrence IS 'Recurrence pattern inherited from template';
COMMENT ON COLUMN public.onboarding_tasks.template_id IS 'Reference to the template this task was created from';