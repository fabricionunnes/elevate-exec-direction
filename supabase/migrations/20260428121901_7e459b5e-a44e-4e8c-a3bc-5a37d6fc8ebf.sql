CREATE OR REPLACE FUNCTION public.sync_crm_sales_pipeline_with_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id THEN
    UPDATE public.crm_sales
    SET pipeline_id = NEW.pipeline_id,
        updated_at = now()
    WHERE lead_id = NEW.id
      AND pipeline_id IS DISTINCT FROM NEW.pipeline_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_crm_sales_pipeline_with_lead_trigger ON public.crm_leads;

CREATE TRIGGER sync_crm_sales_pipeline_with_lead_trigger
AFTER UPDATE OF pipeline_id ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_crm_sales_pipeline_with_lead();