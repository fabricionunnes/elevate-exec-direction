
CREATE OR REPLACE FUNCTION public.get_bank_statement_transactions(
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_bank_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  bank_id uuid,
  type text,
  amount_cents bigint,
  description text,
  created_at timestamptz,
  reference_id uuid,
  reference_type text,
  client_name text,
  interest_cents bigint,
  fee_cents bigint,
  discount_cents bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fbt.id,
    fbt.bank_id,
    fbt.type,
    fbt.amount_cents,
    fbt.description,
    fbt.created_at,
    fbt.reference_id,
    fbt.reference_type,
    CASE
      WHEN fbt.reference_type = 'invoice' THEN oc.name
      WHEN fbt.reference_type = 'payable' THEN fp.supplier_name
      ELSE NULL
    END AS client_name,
    CASE
      WHEN fbt.reference_type = 'invoice' THEN COALESCE(ci.interest_cents, 0)::bigint
      ELSE 0::bigint
    END AS interest_cents,
    CASE
      WHEN fbt.reference_type = 'invoice' THEN (COALESCE(ci.late_fee_cents, 0) + COALESCE(ci.payment_fee_cents, 0))::bigint
      ELSE 0::bigint
    END AS fee_cents,
    0::bigint AS discount_cents
  FROM financial_bank_transactions fbt
  LEFT JOIN company_invoices ci ON fbt.reference_id = ci.id AND fbt.reference_type = 'invoice'
  LEFT JOIN onboarding_companies oc ON ci.company_id = oc.id
  LEFT JOIN financial_payables fp ON fbt.reference_id = fp.id AND fbt.reference_type = 'payable'
  WHERE fbt.created_at >= p_date_from
    AND fbt.created_at <= p_date_to
    AND (p_bank_id IS NULL OR fbt.bank_id = p_bank_id)
  ORDER BY fbt.created_at DESC;
$$;
