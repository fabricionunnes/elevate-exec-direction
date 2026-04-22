
ALTER TABLE public.crm_leads
ADD COLUMN IF NOT EXISTS stage_entered_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.client_crm_leads
ADD COLUMN IF NOT EXISTS stage_entered_at timestamp with time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_stage_entered_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_entered_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_leads_stage_entered_at ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_stage_entered_at
BEFORE UPDATE ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_stage_entered_at();

DROP TRIGGER IF EXISTS trg_client_crm_leads_stage_entered_at ON public.client_crm_leads;
CREATE TRIGGER trg_client_crm_leads_stage_entered_at
BEFORE UPDATE ON public.client_crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_stage_entered_at();
