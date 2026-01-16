-- Function to notify RH staff when a job is opened
CREATE OR REPLACE FUNCTION public.notify_job_opening_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_staff RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Get project and company info
  SELECT p.*, c.name as company_name
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  v_notification_title := '📋 Nova vaga aberta: ' || NEW.title;
  v_notification_message := 'Vaga "' || NEW.title || '" foi aberta para ' || COALESCE(v_project.company_name, v_project.product_name) || ' (' || NEW.area || ' - ' || NEW.job_type || ')';

  -- Notify all active RH staff members
  FOR v_staff IN 
    SELECT id FROM public.onboarding_staff 
    WHERE is_active = true 
    AND role = 'rh'
  LOOP
    INSERT INTO public.onboarding_notifications (
      staff_id,
      project_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      v_staff.id,
      NEW.project_id,
      'job_opened',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'job_opening'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Function to notify Consultant and CS when a job is closed
CREATE OR REPLACE FUNCTION public.notify_job_opening_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only trigger when status changes to 'closed'
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    -- Get project and company info
    SELECT p.*, c.name as company_name, c.consultant_id, c.cs_id
    INTO v_project
    FROM public.onboarding_projects p
    LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
    WHERE p.id = NEW.project_id;

    v_notification_title := '✅ Vaga encerrada: ' || NEW.title;
    v_notification_message := 'A vaga "' || NEW.title || '" foi encerrada para ' || COALESCE(v_project.company_name, v_project.product_name);

    -- Notify Consultant if exists
    IF v_project.consultant_id IS NOT NULL THEN
      INSERT INTO public.onboarding_notifications (
        staff_id,
        project_id,
        type,
        title,
        message,
        reference_id,
        reference_type
      ) VALUES (
        v_project.consultant_id,
        NEW.project_id,
        'job_closed',
        v_notification_title,
        v_notification_message,
        NEW.id,
        'job_opening'
      );
    END IF;

    -- Notify CS if exists and different from consultant
    IF v_project.cs_id IS NOT NULL AND v_project.cs_id IS DISTINCT FROM v_project.consultant_id THEN
      INSERT INTO public.onboarding_notifications (
        staff_id,
        project_id,
        type,
        title,
        message,
        reference_id,
        reference_type
      ) VALUES (
        v_project.cs_id,
        NEW.project_id,
        'job_closed',
        v_notification_title,
        v_notification_message,
        NEW.id,
        'job_opening'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new job openings (notify RH)
DROP TRIGGER IF EXISTS notify_job_opening_created_trigger ON public.job_openings;
CREATE TRIGGER notify_job_opening_created_trigger
AFTER INSERT ON public.job_openings
FOR EACH ROW
EXECUTE FUNCTION public.notify_job_opening_created();

-- Create trigger for closed job openings (notify Consultant/CS)
DROP TRIGGER IF EXISTS notify_job_opening_closed_trigger ON public.job_openings;
CREATE TRIGGER notify_job_opening_closed_trigger
AFTER UPDATE ON public.job_openings
FOR EACH ROW
EXECUTE FUNCTION public.notify_job_opening_closed();