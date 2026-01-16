-- Create function to notify when a new candidate is created
CREATE OR REPLACE FUNCTION public.notify_candidate_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_job RECORD;
  v_staff RECORD;
  v_user RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Get project and company info
  SELECT p.*, c.name as company_name
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  -- Get job info if exists
  IF NEW.job_opening_id IS NOT NULL THEN
    SELECT title INTO v_job FROM public.job_openings WHERE id = NEW.job_opening_id;
  END IF;

  v_notification_title := '👤 Novo candidato: ' || NEW.full_name;
  v_notification_message := 'Candidato "' || NEW.full_name || '" se candidatou';
  
  IF v_job.title IS NOT NULL THEN
    v_notification_message := v_notification_message || ' para a vaga "' || v_job.title || '"';
  END IF;
  
  v_notification_message := v_notification_message || ' em ' || COALESCE(v_project.company_name, v_project.product_name);

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
      'new_candidate',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'candidate'
    );
  END LOOP;

  -- Notify consultant if assigned to project's company
  IF v_project.onboarding_company_id IS NOT NULL THEN
    FOR v_staff IN 
      SELECT consultant_id as id FROM public.onboarding_companies 
      WHERE id = v_project.onboarding_company_id 
      AND consultant_id IS NOT NULL
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
        'new_candidate',
        v_notification_title,
        v_notification_message,
        NEW.id,
        'candidate'
      );
    END LOOP;
  END IF;

  -- Notify all client users associated with the project
  FOR v_user IN 
    SELECT id FROM public.onboarding_users 
    WHERE project_id = NEW.project_id
    AND is_active = true
  LOOP
    INSERT INTO public.onboarding_notifications (
      user_id,
      project_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      v_user.id,
      NEW.project_id,
      'new_candidate',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'candidate'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for new candidates
DROP TRIGGER IF EXISTS trigger_notify_candidate_created ON public.candidates;
CREATE TRIGGER trigger_notify_candidate_created
  AFTER INSERT ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_candidate_created();