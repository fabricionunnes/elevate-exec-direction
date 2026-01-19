-- Create function to notify when a task is assigned to staff
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project RECORD;
  v_creator_staff_id UUID;
  v_creator_name TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only notify if a responsible staff is assigned
  IF NEW.responsible_staff_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- For UPDATE: only notify if responsible changed
  IF TG_OP = 'UPDATE' AND OLD.responsible_staff_id IS NOT DISTINCT FROM NEW.responsible_staff_id THEN
    RETURN NEW;
  END IF;

  -- Get current user's staff info (the creator)
  SELECT id, name INTO v_creator_staff_id, v_creator_name
  FROM public.onboarding_staff
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  -- Don't notify if assigning to yourself
  IF v_creator_staff_id = NEW.responsible_staff_id THEN
    RETURN NEW;
  END IF;

  -- Get project and company info
  SELECT p.*, c.name as company_name
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  v_notification_title := '📋 Nova tarefa atribuída: ' || NEW.title;
  v_notification_message := COALESCE(v_creator_name, 'Alguém') || ' atribuiu uma tarefa para você em ' || 
    COALESCE(v_project.company_name, v_project.product_name, 'um projeto');

  -- Create notification for the assigned staff
  INSERT INTO public.onboarding_notifications (
    staff_id,
    project_id,
    type,
    title,
    message,
    reference_id,
    reference_type
  ) VALUES (
    NEW.responsible_staff_id,
    NEW.project_id,
    'task_assigned',
    v_notification_title,
    v_notification_message,
    NEW.id,
    'task'
  );

  RETURN NEW;
END;
$$;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS trigger_notify_task_assigned_insert ON public.onboarding_tasks;
CREATE TRIGGER trigger_notify_task_assigned_insert
AFTER INSERT ON public.onboarding_tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assigned();

-- Create trigger for UPDATE (when responsible changes)
DROP TRIGGER IF EXISTS trigger_notify_task_assigned_update ON public.onboarding_tasks;
CREATE TRIGGER trigger_notify_task_assigned_update
AFTER UPDATE ON public.onboarding_tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assigned();