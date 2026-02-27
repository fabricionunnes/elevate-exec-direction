
CREATE OR REPLACE FUNCTION public.increment_bank_balance(p_bank_id uuid, p_amount bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE financial_banks 
  SET current_balance_cents = current_balance_cents + p_amount,
      updated_at = now()
  WHERE id = p_bank_id;
END;
$$;
