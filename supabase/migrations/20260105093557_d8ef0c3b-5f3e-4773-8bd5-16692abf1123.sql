
-- Function to create tasks for all active projects when a new template is added
CREATE OR REPLACE FUNCTION public.create_tasks_from_new_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project RECORD;
  v_company RECORD;
  v_start_date DATE;
  v_due_date DATE;
BEGIN
  -- Find all active projects that use this service/product
  FOR v_project IN 
    SELECT p.*, c.contract_start_date, c.status as company_status
    FROM public.onboarding_projects p
    LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
    WHERE p.product_id = NEW.product_id
      AND p.status = 'active'
  LOOP
    -- Skip if company is not active
    IF v_project.company_status IS NOT NULL AND v_project.company_status != 'active' THEN
      CONTINUE;
    END IF;

    -- Calculate dates based on contract start date or today
    v_start_date := COALESCE(v_project.contract_start_date, CURRENT_DATE);
    
    IF NEW.default_days_offset IS NOT NULL AND NEW.default_days_offset > 0 THEN
      v_due_date := public.get_next_business_day(v_start_date, NEW.default_days_offset);
    ELSE
      v_due_date := v_start_date;
    END IF;

    -- Create the task for this project
    INSERT INTO public.onboarding_tasks (
      project_id,
      template_id,
      title,
      description,
      priority,
      status,
      due_date,
      start_date,
      recurrence,
      responsible_staff_id,
      sort_order,
      estimated_hours
    ) VALUES (
      v_project.id,
      NEW.id,
      NEW.title,
      NEW.description,
      COALESCE(NEW.priority, 'medium'),
      'pending',
      v_due_date,
      v_start_date,
      NEW.recurrence,
      -- Try to assign to consultant or CS from company
      (SELECT COALESCE(c.consultant_id, c.cs_id) 
       FROM public.onboarding_companies c 
       WHERE c.id = v_project.onboarding_company_id),
      NEW.sort_order,
      NEW.duration_days
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Create trigger for new templates
DROP TRIGGER IF EXISTS trigger_create_tasks_from_new_template ON public.onboarding_task_templates;
CREATE TRIGGER trigger_create_tasks_from_new_template
  AFTER INSERT ON public.onboarding_task_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.create_tasks_from_new_template();
