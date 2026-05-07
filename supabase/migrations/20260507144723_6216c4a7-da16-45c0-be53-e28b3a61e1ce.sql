-- Trigger para cancelar assinatura no Asaas automaticamente quando is_active muda true -> false
CREATE OR REPLACE FUNCTION public.cancel_asaas_subscription_on_inactivate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_anon text;
BEGIN
  IF OLD.is_active = true
     AND NEW.is_active = false
     AND NEW.pagarme_plan_id IS NOT NULL
     AND NEW.pagarme_plan_id <> '' THEN

    v_url := 'https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/asaas-cancel-subscription';
    v_anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXlqZ2RpeHdocGZhc2Z1Z2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzI4MTksImV4cCI6MjA4MTMwODgxOX0.1mzzTilIbJPCxgBBCUK5diMsjUGalKRm78ZzZl8JyzY';

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon,
        'Authorization', 'Bearer ' || v_anon
      ),
      body := jsonb_build_object(
        'subscription_id', NEW.pagarme_plan_id,
        'asaas_account_id', NEW.asaas_account_id
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Não bloqueia o update se a chamada HTTP falhar
  RAISE WARNING 'cancel_asaas_subscription_on_inactivate failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_asaas_on_inactivate ON public.company_recurring_charges;
CREATE TRIGGER trg_cancel_asaas_on_inactivate
AFTER UPDATE OF is_active ON public.company_recurring_charges
FOR EACH ROW
EXECUTE FUNCTION public.cancel_asaas_subscription_on_inactivate();