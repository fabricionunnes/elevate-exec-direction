-- Create trigger function to notify staff about companies without consultant
CREATE OR REPLACE FUNCTION public.notify_company_without_consultant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_staff_member RECORD;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only notify if consultant_id is NULL
  IF NEW.consultant_id IS NULL THEN
    v_notification_title := '⚠️ Nova empresa sem consultor: ' || NEW.name;
    v_notification_message := 'A empresa "' || NEW.name || '" foi cadastrada sem um consultor atribuído. Por favor, atribua um consultor.';

    -- Notify all active admin and CS staff
    FOR v_staff_member IN 
      SELECT id FROM public.onboarding_staff 
      WHERE is_active = true 
      AND role IN ('admin', 'cs')
    LOOP
      INSERT INTO public.onboarding_notifications (
        staff_id,
        type,
        title,
        message,
        reference_id,
        reference_type
      ) VALUES (
        v_staff_member.id,
        'company_no_consultant',
        v_notification_title,
        v_notification_message,
        NEW.id,
        'company'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on company insert
DROP TRIGGER IF EXISTS trigger_notify_company_without_consultant ON public.onboarding_companies;
CREATE TRIGGER trigger_notify_company_without_consultant
  AFTER INSERT ON public.onboarding_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_company_without_consultant();