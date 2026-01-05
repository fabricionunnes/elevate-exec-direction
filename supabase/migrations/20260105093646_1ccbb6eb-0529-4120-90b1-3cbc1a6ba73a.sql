
-- Function to delete uncompleted tasks when a template is deleted
CREATE OR REPLACE FUNCTION public.delete_tasks_from_deleted_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete tasks that:
  -- 1. Were created from this template
  -- 2. Are NOT completed
  -- 3. Belong to active projects
  DELETE FROM public.onboarding_tasks t
  USING public.onboarding_projects p
  WHERE t.template_id = OLD.id
    AND t.project_id = p.id
    AND p.status = 'active'
    AND t.status != 'completed';

  RETURN OLD;
END;
$function$;

-- Create trigger for deleted templates
DROP TRIGGER IF EXISTS trigger_delete_tasks_from_deleted_template ON public.onboarding_task_templates;
CREATE TRIGGER trigger_delete_tasks_from_deleted_template
  BEFORE DELETE ON public.onboarding_task_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_tasks_from_deleted_template();
