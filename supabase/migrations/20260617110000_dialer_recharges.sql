-- Recargas da carteira do discador (via Asaas).
CREATE TABLE IF NOT EXISTS public.dialer_recharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | cancelled
  asaas_payment_id TEXT,
  invoice_url TEXT,
  pix_payload TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_dialer_recharges_tenant ON public.dialer_recharges(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dialer_recharges_payment ON public.dialer_recharges(asaas_payment_id);

ALTER TABLE public.dialer_recharges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CRM users manage dialer recharges" ON public.dialer_recharges;
CREATE POLICY "CRM users manage dialer recharges" ON public.dialer_recharges FOR ALL USING (public.has_crm_access()) WITH CHECK (public.has_crm_access());
GRANT ALL ON public.dialer_recharges TO anon, authenticated, service_role;
