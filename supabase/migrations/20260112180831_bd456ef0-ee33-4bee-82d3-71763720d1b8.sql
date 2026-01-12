-- Update the recurring task trigger to support all recurrence types
CREATE OR REPLACE FUNCTION public.create_next_recurring_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  days_offset INTEGER;
  next_due_date DATE;
  next_start_date DATE;
  new_task_id UUID;
  v_project RECORD;
  v_company RECORD;
  v_actor_user_id UUID;
  v_actor_staff_id UUID;
BEGIN
  -- Only run when task is marked completed and is recurring
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.recurrence IS NOT NULL THEN

    -- Ensure project is active
    SELECT * INTO v_project
    FROM public.onboarding_projects
    WHERE id = NEW.project_id;

    IF v_project.id IS NULL OR v_project.status IS DISTINCT FROM 'active' THEN
      RETURN NEW;
    END IF;

    -- Ensure company is active + within contract period (if dates exist)
    IF v_project.onboarding_company_id IS NOT NULL THEN
      SELECT * INTO v_company
      FROM public.onboarding_companies
      WHERE id = v_project.onboarding_company_id;

      IF v_company.id IS NOT NULL THEN
        IF v_company.status IS DISTINCT FROM 'active' THEN
          RETURN NEW;
        END IF;

        IF v_company.contract_end_date IS NOT NULL AND v_company.contract_end_date < CURRENT_DATE THEN
          RETURN NEW;
        END IF;
      END IF;
    END IF;

    -- Determine offset based on recurrence type
    CASE NEW.recurrence
      -- Daily (every business day - Monday to Friday)
      WHEN 'daily' THEN days_offset := 1;
      WHEN 'daily_weekdays' THEN days_offset := 1;
      -- Daily all days (Monday to Sunday - calendar days)
      WHEN 'daily_all_days' THEN 
        next_due_date := COALESCE(NEW.due_date, CURRENT_DATE) + 1;
        next_start_date := COALESCE(NEW.start_date, COALESCE(NEW.due_date, CURRENT_DATE)) + 1;
        days_offset := NULL; -- Will use calendar days instead
      -- Weekly (~5 business days)
      WHEN 'weekly' THEN days_offset := 5;
      -- Biweekly/Quinzenal (~10 business days)
      WHEN 'biweekly' THEN days_offset := 10;
      -- Monthly (~22 business days)
      WHEN 'monthly' THEN days_offset := 22;
      -- Bimonthly (~44 business days = 2 months)
      WHEN 'bimonthly' THEN days_offset := 44;
      -- Quarterly (~66 business days = 3 months)
      WHEN 'quarterly' THEN days_offset := 66;
      ELSE days_offset := NULL;
    END CASE;

    -- If no valid recurrence type found, exit
    IF days_offset IS NULL AND next_due_date IS NULL THEN
      RETURN NEW;
    END IF;

    -- Compute next dates using business days if days_offset is set
    IF days_offset IS NOT NULL THEN
      next_due_date := public.get_next_business_day(COALESCE(NEW.due_date, CURRENT_DATE), days_offset);
      next_start_date := public.get_next_business_day(COALESCE(NEW.start_date, COALESCE(NEW.due_date, CURRENT_DATE)), days_offset);
    END IF;

    -- Create next recurring task
    INSERT INTO public.onboarding_tasks (
      project_id,
      title,
      description,
      priority,
      status,
      due_date,
      start_date,
      recurrence,
      template_id,
      responsible_staff_id,
      assignee_id,
      sort_order,
      tags,
      estimated_hours,
      is_internal
    ) VALUES (
      NEW.project_id,
      NEW.title,
      NEW.description,
      NEW.priority,
      'pending',
      next_due_date,
      next_start_date,
      NEW.recurrence,
      NEW.template_id,
      NEW.responsible_staff_id,
      NEW.assignee_id,
      NEW.sort_order,
      NEW.tags,
      NEW.estimated_hours,
      COALESCE(NEW.is_internal, false)
    ) RETURNING id INTO new_task_id;

    -- Try to attribute history entry to the actor (either onboarding user or staff)
    SELECT ou.id
      INTO v_actor_user_id
    FROM public.onboarding_users ou
    WHERE ou.project_id = NEW.project_id
      AND ou.user_id = auth.uid()
    LIMIT 1;

    SELECT os.id
      INTO v_actor_staff_id
    FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
      AND os.is_active = true
    LIMIT 1;

    -- Insert history only if we can satisfy constraint history_user_or_staff
    IF v_actor_staff_id IS NOT NULL OR v_actor_user_id IS NOT NULL THEN
      INSERT INTO public.onboarding_task_history (
        task_id,
        action,
        field_changed,
        new_value,
        staff_id,
        user_id
      ) VALUES (
        new_task_id,
        'created',
        'recurrence',
        'Tarefa recorrente gerada automaticamente a partir de: ' || NEW.id::text,
        v_actor_staff_id,
        v_actor_user_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;