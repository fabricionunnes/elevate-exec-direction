
-- Data migration for existing client records (safe to skip on fresh database)
DO $$
BEGIN
  -- 1. Enable menu permission for project
  UPDATE project_menu_permissions
  SET is_enabled = true
  WHERE id = '04621168-2315-4bf6-98eb-5e6420240999';

  -- 2. Mark invoice as paid
  UPDATE company_invoices
  SET status = 'paid',
      paid_at = now(),
      paid_amount_cents = 2700,
      payment_fee_cents = 199
  WHERE id = '83bd3328-b239-4953-9328-54831ca850b9';

  -- 3. Mark financial receivable as paid
  UPDATE financial_receivables
  SET status = 'paid'
  WHERE id = '38cceacd-a299-4d6d-bd56-1536e2f4dc4d';

  -- 4. Credit Asaas bank (2700 - 199 = 2501 centavos)
  PERFORM public.increment_bank_balance('cb223279-5087-47ec-bd02-2b7b412cf21a'::uuid, 2501);

  -- 5. Record bank transaction
  INSERT INTO financial_bank_transactions (bank_id, type, amount_cents, description, reference_type, reference_id)
  VALUES ('cb223279-5087-47ec-bd02-2b7b412cf21a', 'credit', 2501, 'Recebimento Asaas: Serviço Testes - compra self-service (taxa R$1,99 deduzida)', 'invoice', '83bd3328-b239-4953-9328-54831ca850b9');

  -- 6. Create service_purchases record (simple insert)
  INSERT INTO service_purchases (project_id, service_catalog_id, menu_key, billing_type, amount_cents, status, recurring_charge_id, asaas_subscription_id, purchased_by)
  SELECT
    '58b0cbd2-eafa-4e3e-90d4-47d86ec5154b',
    sc.id,
    'testes',
    'one_time',
    2700,
    'active',
    '890ca5c8-d0da-4c26-8bd2-bff3735a8d2d',
    'pay_3onzvvo9gnn5bry2',
    ou.id
  FROM service_catalog sc, onboarding_users ou
  WHERE sc.menu_key = 'testes'
  AND ou.project_id = '58b0cbd2-eafa-4e3e-90d4-47d86ec5154b'
  AND ou.role = 'client'
  LIMIT 1;
EXCEPTION WHEN OTHERS THEN
  -- Skip data migrations that reference records not present in this database
  NULL;
END $$;
