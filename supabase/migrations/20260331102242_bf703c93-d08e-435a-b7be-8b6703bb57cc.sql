-- Trigger function: auto-set status to 'paid' when amount is reduced to match paid_amount
CREATE OR REPLACE FUNCTION public.auto_reconcile_partial_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only act when there's a paid_amount
  IF NEW.paid_amount IS NOT NULL AND NEW.paid_amount > 0 THEN
    IF NEW.amount <= NEW.paid_amount AND NEW.status != 'paid' THEN
      NEW.status := 'paid';
      IF NEW.paid_at IS NULL THEN
        NEW.paid_at := now();
      END IF;
    ELSIF NEW.amount > NEW.paid_amount AND NEW.status = 'paid' THEN
      NEW.status := 'partial';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Apply to financial_receivables
DROP TRIGGER IF EXISTS trg_auto_reconcile_financial_receivables ON public.financial_receivables;
CREATE TRIGGER trg_auto_reconcile_financial_receivables
  BEFORE UPDATE ON public.financial_receivables
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount)
  EXECUTE FUNCTION public.auto_reconcile_partial_status();

-- Apply to financial_payables
DROP TRIGGER IF EXISTS trg_auto_reconcile_financial_payables ON public.financial_payables;
CREATE TRIGGER trg_auto_reconcile_financial_payables
  BEFORE UPDATE ON public.financial_payables
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount)
  EXECUTE FUNCTION public.auto_reconcile_partial_status();

-- Apply to client_financial_receivables
DROP TRIGGER IF EXISTS trg_auto_reconcile_client_receivables ON public.client_financial_receivables;
CREATE TRIGGER trg_auto_reconcile_client_receivables
  BEFORE UPDATE ON public.client_financial_receivables
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount)
  EXECUTE FUNCTION public.auto_reconcile_partial_status();

-- Apply to client_financial_payables
DROP TRIGGER IF EXISTS trg_auto_reconcile_client_payables ON public.client_financial_payables;
CREATE TRIGGER trg_auto_reconcile_client_payables
  BEFORE UPDATE ON public.client_financial_payables
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount)
  EXECUTE FUNCTION public.auto_reconcile_partial_status();