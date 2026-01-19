-- Fix overdue status function: due_date must be BEFORE today (not equal to today)
CREATE OR REPLACE FUNCTION public.update_client_financial_overdue_status()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update receivables: only mark as overdue if due_date is BEFORE today (not equal)
  UPDATE public.client_financial_receivables
  SET status = 'overdue'
  WHERE status = 'open' AND due_date < CURRENT_DATE;
  
  -- Update payables: only mark as overdue if due_date is BEFORE today (not equal)
  UPDATE public.client_financial_payables
  SET status = 'overdue'
  WHERE status = 'open' AND due_date < CURRENT_DATE;
END;
$function$;