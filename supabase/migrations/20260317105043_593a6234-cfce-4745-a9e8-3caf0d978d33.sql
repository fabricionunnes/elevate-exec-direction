CREATE OR REPLACE FUNCTION public.handle_meeting_finalized()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_survey_id UUID;
BEGIN
  IF NEW.is_finalized = true AND (OLD.is_finalized IS NULL OR OLD.is_finalized = false) THEN
    IF EXISTS (SELECT 1 FROM public.csat_surveys WHERE meeting_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.csat_surveys (project_id, meeting_id)
    VALUES (NEW.project_id, NEW.id)
    RETURNING id INTO v_survey_id;
  END IF;
  RETURN NEW;
END;
$function$;