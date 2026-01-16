-- Create function to notify HR when a DISC test is completed
CREATE OR REPLACE FUNCTION public.notify_disc_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate RECORD;
  v_project RECORD;
  v_staff RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get candidate info
    SELECT c.*, jo.title as job_title
    INTO v_candidate
    FROM public.candidates c
    LEFT JOIN public.job_openings jo ON jo.id = c.job_opening_id
    WHERE c.id = NEW.candidate_id;

    IF v_candidate IS NULL THEN
      RETURN NEW;
    END IF;

    -- Get project and company info
    SELECT p.*, co.name as company_name
    INTO v_project
    FROM public.onboarding_projects p
    LEFT JOIN public.onboarding_companies co ON co.id = p.onboarding_company_id
    WHERE p.id = v_candidate.project_id;

    v_notification_title := '✅ DISC concluído: ' || v_candidate.full_name;
    v_notification_message := 'O candidato "' || v_candidate.full_name || '" completou o teste DISC';
    
    IF v_candidate.job_title IS NOT NULL THEN
      v_notification_message := v_notification_message || ' para a vaga "' || v_candidate.job_title || '"';
    END IF;
    
    v_notification_message := v_notification_message || ' - Perfil: ' || COALESCE(NEW.dominant_profile, 'N/A');

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
        v_candidate.project_id,
        'disc_completed',
        v_notification_title,
        v_notification_message,
        NEW.candidate_id,
        'candidate'
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for DISC completion
DROP TRIGGER IF EXISTS trigger_notify_disc_completed ON public.candidate_disc_results;
CREATE TRIGGER trigger_notify_disc_completed
  AFTER UPDATE ON public.candidate_disc_results
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_disc_completed();