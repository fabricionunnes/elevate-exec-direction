-- Incremento 6 (LGPD): marca quando a gravação foi apagada (transcrição é mantida).
ALTER TABLE public.crm_calls ADD COLUMN IF NOT EXISTS recording_deleted_at TIMESTAMPTZ;

-- Incremento 7: cobrança por usuário ativo.
CREATE TABLE IF NOT EXISTS public.dialer_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  active_users INTEGER NOT NULL DEFAULT 0,
  plan_price_per_user NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  franchise_minutes_granted INTEGER NOT NULL DEFAULT 0,
  asaas_payment_id TEXT,
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  UNIQUE (tenant_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_dialer_billing_tenant ON public.dialer_billing(tenant_id, period_start DESC);

ALTER TABLE public.dialer_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope_dialer_billing ON public.dialer_billing;
CREATE POLICY tenant_scope_dialer_billing ON public.dialer_billing FOR ALL
USING (
  CASE
    WHEN public.is_master_user() THEN (tenant_id IS NULL)
    WHEN public.current_user_tenant_id() IS NOT NULL THEN (tenant_id = public.current_user_tenant_id())
    ELSE true
  END
) WITH CHECK (true);
GRANT ALL ON public.dialer_billing TO anon, authenticated, service_role;
