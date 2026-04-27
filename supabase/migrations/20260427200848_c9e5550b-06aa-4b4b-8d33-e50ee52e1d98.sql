-- Trigger: ao inativar um staff, desvincular ele dos leads do CRM (sem deletar)
CREATE OR REPLACE FUNCTION public.unassign_leads_on_staff_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.crm_leads
    SET owner_staff_id = NULL
    WHERE owner_staff_id = OLD.id;

    UPDATE public.crm_leads
    SET sdr_staff_id = NULL
    WHERE sdr_staff_id = OLD.id;

    UPDATE public.crm_leads
    SET closer_staff_id = NULL
    WHERE closer_staff_id = OLD.id;

    UPDATE public.crm_leads
    SET scheduled_by_staff_id = NULL
    WHERE scheduled_by_staff_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unassign_leads_on_staff_deactivation ON public.onboarding_staff;
CREATE TRIGGER trg_unassign_leads_on_staff_deactivation
AFTER UPDATE OF is_active ON public.onboarding_staff
FOR EACH ROW
EXECUTE FUNCTION public.unassign_leads_on_staff_deactivation();