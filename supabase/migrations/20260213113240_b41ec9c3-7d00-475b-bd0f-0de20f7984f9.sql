-- Drop the duplicate trigger that causes recurring tasks to be created twice
DROP TRIGGER IF EXISTS trigger_create_recurring_task ON public.onboarding_tasks;