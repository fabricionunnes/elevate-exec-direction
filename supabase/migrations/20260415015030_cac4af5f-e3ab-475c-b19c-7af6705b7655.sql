
CREATE OR REPLACE FUNCTION public.auto_reconcile_partial_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  effective_paid numeric;
BEGIN
  IF NEW.paid_amount IS NOT NULL AND NEW.paid_amount > 0 THEN
    -- Consider fees and discounts as part of the "paid" total
    effective_paid := NEW.paid_amount 
      + COALESCE(NEW.fee_amount, 0) 
      + COALESCE(NEW.discount_amount, 0);
    
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
$function$;
