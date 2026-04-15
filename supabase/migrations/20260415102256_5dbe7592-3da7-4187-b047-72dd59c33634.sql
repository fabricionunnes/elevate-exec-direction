CREATE OR REPLACE FUNCTION public.auto_reconcile_partial_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  effective_paid numeric;
BEGIN
  IF NEW.paid_amount IS NOT NULL AND NEW.paid_amount > 0 THEN
    effective_paid := NEW.paid_amount;
    
    IF NEW.amount <= effective_paid AND NEW.status != 'paid' THEN
      NEW.status := 'paid';
      IF NEW.paid_date IS NULL THEN
        NEW.paid_date := now();
      END IF;
    ELSIF NEW.amount > effective_paid AND NEW.status = 'paid' THEN
      NEW.status := 'partial';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;