
-- Trigger to mark survey_send_log as "responded" when NPS response is created
CREATE OR REPLACE FUNCTION public.mark_nps_send_log_responded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark all pending/sent logs for this project as responded
  UPDATE public.survey_send_log
  SET status = 'responded',
      responded_at = NOW(),
      nps_response_id = NEW.id
  WHERE project_id = NEW.project_id
    AND survey_type = 'nps'
    AND status IN ('sent', 'pending');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_mark_nps_responded
  AFTER INSERT ON public.onboarding_nps_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_nps_send_log_responded();

-- Trigger to mark survey_send_log as "responded" when CSAT response is created
CREATE OR REPLACE FUNCTION public.mark_csat_send_log_responded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark all pending/sent logs for this CSAT survey as responded
  UPDATE public.survey_send_log
  SET status = 'responded',
      responded_at = NOW()
  WHERE csat_survey_id = NEW.survey_id
    AND survey_type = 'csat'
    AND status IN ('sent', 'pending');
  
  -- Also update the csat_survey status
  UPDATE public.csat_surveys
  SET status = 'responded', updated_at = NOW()
  WHERE id = NEW.survey_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_mark_csat_responded
  AFTER INSERT ON public.csat_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_csat_send_log_responded();
