-- Function to notify staff when kickoff form is submitted
CREATE OR REPLACE FUNCTION public.notify_kickoff_form_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Check if kickoff form was just filled (main_challenges going from null/empty to having value)
  IF (OLD.main_challenges IS NULL OR OLD.main_challenges = '') 
     AND (NEW.main_challenges IS NOT NULL AND NEW.main_challenges != '') THEN
    
    v_notification_title := '📋 Kickoff preenchido: ' || NEW.name;
    v_notification_message := 'O cliente ' || NEW.name || ' preencheu o formulário de Kickoff. Revise as informações para alinhar a estratégia.';

    -- Notify CS if exists
    IF NEW.cs_id IS NOT NULL THEN
      INSERT INTO public.onboarding_notifications (
        staff_id,
        type,
        title,
        message,
        reference_id,
        reference_type
      ) VALUES (
        NEW.cs_id,
        'kickoff_form',
        v_notification_title,
        v_notification_message,
        NEW.id,
        'company'
      );
    END IF;

    -- Notify Consultant if exists and different from CS
    IF NEW.consultant_id IS NOT NULL AND NEW.consultant_id IS DISTINCT FROM NEW.cs_id THEN
      INSERT INTO public.onboarding_notifications (
        staff_id,
        type,
        title,
        message,
        reference_id,
        reference_type
      ) VALUES (
        NEW.consultant_id,
        'kickoff_form',
        v_notification_title,
        v_notification_message,
        NEW.id,
        'company'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for kickoff form submission
DROP TRIGGER IF EXISTS on_kickoff_form_submitted ON public.onboarding_companies;
CREATE TRIGGER on_kickoff_form_submitted
  AFTER UPDATE ON public.onboarding_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_kickoff_form_submitted();