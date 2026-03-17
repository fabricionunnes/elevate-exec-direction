
-- Create trigger function to deactivate tasks when company becomes inactive
-- The function body references 'inactive' enum value which was added in a previous migration
CREATE OR REPLACE FUNCTION public.deactivate_tasks_on_company_inactive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status != 'active' THEN
    UPDATE public.onboarding_tasks t
    SET status = 'inactive'::onboarding_task_status, updated_at = now()
    FROM public.onboarding_projects p
    WHERE t.project_id = p.id
      AND p.onboarding_company_id = NEW.id
      AND t.status IN ('pending', 'in_progress');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_tasks_on_company_inactive ON public.onboarding_companies;
CREATE TRIGGER trg_deactivate_tasks_on_company_inactive
  AFTER UPDATE OF status ON public.onboarding_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_tasks_on_company_inactive();
