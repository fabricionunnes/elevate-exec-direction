-- Funções atômicas de débito/crédito da carteira do discador.

CREATE OR REPLACE FUNCTION public.dialer_debit_wallet(
  p_tenant UUID, p_amount NUMERIC, p_minutes NUMERIC, p_ref UUID, p_desc TEXT
) RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance NUMERIC;
BEGIN
  INSERT INTO public.dialer_wallets (tenant_id) VALUES (p_tenant) ON CONFLICT (tenant_id) DO NOTHING;
  UPDATE public.dialer_wallets
     SET balance = balance - p_amount, total_spent = total_spent + p_amount, updated_at = now()
   WHERE tenant_id = p_tenant
   RETURNING balance INTO v_balance;
  INSERT INTO public.dialer_ledger (tenant_id, amount, balance_after, minutes, operation, description, reference_id, reference_type)
  VALUES (p_tenant, -p_amount, v_balance, p_minutes, 'debit_call', p_desc, p_ref, 'crm_call');
  RETURN v_balance;
END; $$;

CREATE OR REPLACE FUNCTION public.dialer_credit_wallet(
  p_tenant UUID, p_amount NUMERIC, p_operation TEXT, p_desc TEXT, p_ref UUID
) RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance NUMERIC;
BEGIN
  INSERT INTO public.dialer_wallets (tenant_id) VALUES (p_tenant) ON CONFLICT (tenant_id) DO NOTHING;
  UPDATE public.dialer_wallets
     SET balance = balance + p_amount,
         total_deposited = total_deposited + (CASE WHEN p_operation = 'recharge' THEN p_amount ELSE 0 END),
         updated_at = now()
   WHERE tenant_id = p_tenant
   RETURNING balance INTO v_balance;
  INSERT INTO public.dialer_ledger (tenant_id, amount, balance_after, operation, description, reference_id, reference_type)
  VALUES (p_tenant, p_amount, v_balance, COALESCE(p_operation, 'adjustment'), p_desc, p_ref, NULL);
  RETURN v_balance;
END; $$;

GRANT EXECUTE ON FUNCTION public.dialer_debit_wallet(UUID, NUMERIC, NUMERIC, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dialer_credit_wallet(UUID, NUMERIC, TEXT, TEXT, UUID) TO anon, authenticated, service_role;
