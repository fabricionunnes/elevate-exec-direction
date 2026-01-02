-- Create trigger function to notify staff on low NPS scores
CREATE OR REPLACE FUNCTION public.notify_low_nps_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project RECORD;
  v_company RECORD;
  v_staff_member RECORD;
  v_score_label TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only notify for scores below 8 (detractors and neutrals)
  IF NEW.score >= 8 THEN
    RETURN NEW;
  END IF;

  -- Get project and company info
  SELECT p.*, c.name as company_name, c.cs_id, c.consultant_id
  INTO v_project
  FROM public.onboarding_projects p
  LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.id = NEW.project_id;

  -- Determine score category
  IF NEW.score <= 6 THEN
    v_score_label := 'DETRATOR';
  ELSE
    v_score_label := 'NEUTRO';
  END IF;

  v_notification_title := '⚠️ NPS ' || v_score_label || ': Nota ' || NEW.score;
  v_notification_message := 'Cliente ' || COALESCE(NEW.respondent_name, 'anônimo') || 
    ' deu nota ' || NEW.score || ' para ' || COALESCE(v_project.company_name, v_project.product_name) ||
    '. Motivo: ' || COALESCE(SUBSTRING(NEW.would_recommend_why FROM 1 FOR 100), 'não informado');

  -- Notify CS responsible
  IF v_project.cs_id IS NOT NULL THEN
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
      'nps_alert',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'nps'
    );
  END IF;

  -- Notify Consultant responsible
  IF v_project.consultant_id IS NOT NULL AND v_project.consultant_id IS DISTINCT FROM v_project.cs_id THEN
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
      'nps_alert',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'nps'
    );
  END IF;

  -- Notify all admin staff members
  FOR v_staff_member IN 
    SELECT id FROM public.onboarding_staff 
    WHERE role = 'admin' AND is_active = true
    AND id IS DISTINCT FROM v_project.cs_id
    AND id IS DISTINCT FROM v_project.consultant_id
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
      v_staff_member.id,
      NEW.project_id,
      'nps_alert',
      v_notification_title,
      v_notification_message,
      NEW.id,
      'nps'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for NPS notifications
DROP TRIGGER IF EXISTS on_low_nps_response ON public.onboarding_nps_responses;
CREATE TRIGGER on_low_nps_response
  AFTER INSERT ON public.onboarding_nps_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_nps_score();