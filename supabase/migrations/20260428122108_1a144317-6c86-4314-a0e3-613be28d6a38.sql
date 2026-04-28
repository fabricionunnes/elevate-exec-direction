CREATE OR REPLACE FUNCTION public.set_crm_sale_pipeline_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pipeline_id uuid;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    SELECT pipeline_id
    INTO _pipeline_id
    FROM public.crm_leads
    WHERE id = NEW.lead_id;

    IF FOUND THEN
      NEW.pipeline_id := _pipeline_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_crm_sale_pipeline_from_lead_trigger ON public.crm_sales;

CREATE TRIGGER set_crm_sale_pipeline_from_lead_trigger
BEFORE INSERT OR UPDATE OF lead_id ON public.crm_sales
FOR EACH ROW
EXECUTE FUNCTION public.set_crm_sale_pipeline_from_lead();