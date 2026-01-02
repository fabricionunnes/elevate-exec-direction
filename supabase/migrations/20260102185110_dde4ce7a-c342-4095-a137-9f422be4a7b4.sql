-- Fix responsible staff mapping when a ticket is created
-- The onboarding_tickets.assigned_to column references onboarding_users.id,
-- while onboarding_tasks.responsible_staff_id references onboarding_staff.id.
-- This function now maps onboarding_users -> onboarding_staff via shared auth user_id.

CREATE OR REPLACE FUNCTION public.handle_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project RECORD;
  v_company RECORD;
  v_ticket_creator_name TEXT;
  v_responsible_staff_id UUID;
  v_task_id UUID;
  v_task_title TEXT;
BEGIN
  -- Get project and company info
  SELECT p.*, c.name as company_name, c.cs_id, c.consultant_id
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  -- Get ticket creator info
  SELECT ou.name
  INTO v_ticket_creator_name
  FROM public.onboarding_users ou
  WHERE ou.id = NEW.created_by;

  -- Determine responsible staff
  -- assigned_to is onboarding_users.id, so map it to onboarding_staff.id via auth user_id
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT os.id
    INTO v_responsible_staff_id
    FROM public.onboarding_users ou
    JOIN public.onboarding_staff os ON os.user_id = ou.user_id
    WHERE ou.id = NEW.assigned_to
      AND ou.role IN ('cs', 'consultant')
      AND os.is_active = true
    LIMIT 1;

    -- Fallback to project's CS/consultant if mapping fails
    IF v_responsible_staff_id IS NULL THEN
      v_responsible_staff_id := v_project.cs_id;
    END IF;
  ELSIF v_project.cs_id IS NOT NULL THEN
    v_responsible_staff_id := v_project.cs_id;
  ELSIF v_project.consultant_id IS NOT NULL THEN
    v_responsible_staff_id := v_project.consultant_id;
  END IF;

  -- Create task title
  v_task_title := '[CHAMADO] ' || NEW.subject;

  -- Create urgent task for the ticket
  INSERT INTO public.onboarding_tasks (
    project_id,
    title,
    description,
    priority,
    status,
    due_date,
    responsible_staff_id,
    sort_order
  ) VALUES (
    NEW.project_id,
    v_task_title,
    'Chamado aberto por ' || COALESCE(v_ticket_creator_name, 'cliente') || E'\n\n' || NEW.message,
    'high',
    'pending',
    CURRENT_DATE,
    v_responsible_staff_id,
    0
  ) RETURNING id INTO v_task_id;

  -- Update ticket with task reference
  UPDATE public.onboarding_tickets SET task_id = v_task_id WHERE id = NEW.id;

  -- Create notification for responsible staff
  IF v_responsible_staff_id IS NOT NULL THEN
    INSERT INTO public.onboarding_notifications (
      staff_id,
      project_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      v_responsible_staff_id,
      NEW.project_id,
      'ticket',
      'Novo chamado: ' || NEW.subject,
      'Chamado aberto por ' || COALESCE(v_ticket_creator_name, 'cliente') || ' - ' || COALESCE(v_project.company_name, v_project.product_name),
      NEW.id,
      'ticket'
    );
  END IF;

  RETURN NEW;
END;
$$;