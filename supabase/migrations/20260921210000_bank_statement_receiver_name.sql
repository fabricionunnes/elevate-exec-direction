-- Extrato: nome de quem pagou/recebeu também quando a fatura não tem empresa vinculada (recebedor avulso)
create or replace function public.get_bank_statement_transactions(p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_bank_id uuid DEFAULT NULL::uuid)
 returns table(id uuid, bank_id uuid, type text, amount_cents bigint, description text, created_at timestamp with time zone, reference_id uuid, reference_type text, client_name text, interest_cents bigint, fee_cents bigint, discount_cents bigint)
 language sql stable security definer set search_path to 'public'
as $function$
  SELECT fbt.id, fbt.bank_id, fbt.type, fbt.amount_cents, fbt.description, fbt.created_at, fbt.reference_id, fbt.reference_type,
    CASE
      WHEN fbt.reference_type = 'invoice' THEN coalesce(oc.name, ci.custom_receiver_name)
      WHEN fbt.reference_type = 'payable' THEN fp.supplier_name
      ELSE NULL
    END AS client_name,
    COALESCE(fbt.interest_cents, 0)::bigint, COALESCE(fbt.fee_cents, 0)::bigint, COALESCE(fbt.discount_cents, 0)::bigint
  FROM financial_bank_transactions fbt
  LEFT JOIN company_invoices ci ON fbt.reference_id = ci.id AND fbt.reference_type = 'invoice'
  LEFT JOIN onboarding_companies oc ON ci.company_id = oc.id
  LEFT JOIN financial_payables fp ON fbt.reference_id = fp.id AND fbt.reference_type = 'payable'
  WHERE fbt.created_at >= p_date_from AND fbt.created_at <= p_date_to
    AND (p_bank_id IS NULL OR fbt.bank_id = p_bank_id)
  ORDER BY fbt.created_at DESC, fbt.id;
$function$;
