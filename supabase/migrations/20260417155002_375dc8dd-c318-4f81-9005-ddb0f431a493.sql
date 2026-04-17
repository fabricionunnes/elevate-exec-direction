ALTER TABLE public.whitelabel_tenants
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS first_payment_link TEXT,
  ADD COLUMN IF NOT EXISTS first_payment_due_at DATE,
  ADD COLUMN IF NOT EXISTS first_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asaas_first_payment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_wl_tenants_first_payment
  ON public.whitelabel_tenants(asaas_first_payment_id)
  WHERE asaas_first_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wl_tenants_subscription
  ON public.whitelabel_tenants(asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.whitelabel_tenants.payment_status IS
  'active = pagamento em dia | pending = aguardando 1ª fatura | overdue = atrasado | not_required = sem cobrança (UNV/trial sem cartão)';