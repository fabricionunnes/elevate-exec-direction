-- ============ DISCADOR COMO PRODUTO: tenant + carteira + extrato + preços ============

-- Preços do discador (configurável). tenant_id NULL = padrão global; por tenant = override.
CREATE TABLE IF NOT EXISTS public.dialer_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  plan_price_per_user NUMERIC(12,2) NOT NULL DEFAULT 997.00,      -- assinatura por usuário ativo/mês
  included_minutes_per_user INTEGER NOT NULL DEFAULT 1000,        -- franquia de minutos/usuário/mês
  price_per_minute NUMERIC(12,2) NOT NULL DEFAULT 1.20,           -- debitado da carteira por minuto
  overage_per_minute NUMERIC(12,2) NOT NULL DEFAULT 1.20,         -- excedente acima da franquia
  setup_fee NUMERIC(12,2) NOT NULL DEFAULT 7000.00,               -- setup único
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dialer_pricing_tenant ON public.dialer_pricing(tenant_id) WHERE tenant_id IS NOT NULL;

-- Carteira pré-paga por tenant (créditos em BRL). Mesmo padrão do circle_ads_wallets.
CREATE TABLE IF NOT EXISTS public.dialer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deposited NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

-- Extrato (cada débito de minuto / recarga / franquia / ajuste)
CREATE TABLE IF NOT EXISTS public.dialer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,           -- negativo = débito, positivo = crédito
  balance_after NUMERIC(12,2),
  minutes NUMERIC(10,2),
  operation TEXT NOT NULL,                 -- debit_call | recharge | franchise_grant | adjustment
  description TEXT,
  reference_id UUID,                       -- ex: crm_calls.id
  reference_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dialer_ledger_tenant ON public.dialer_ledger(tenant_id, created_at DESC);

-- tenant_id no discador (NULL = UNV/owner; preenchido = cliente)
ALTER TABLE public.crm_dialer_campaigns ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id);
ALTER TABLE public.crm_calls ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id);

-- triggers updated_at
DROP TRIGGER IF EXISTS trg_dialer_pricing_updated ON public.dialer_pricing;
CREATE TRIGGER trg_dialer_pricing_updated BEFORE UPDATE ON public.dialer_pricing FOR EACH ROW EXECUTE FUNCTION public.crm_dialer_set_updated_at();
DROP TRIGGER IF EXISTS trg_dialer_wallets_updated ON public.dialer_wallets;
CREATE TRIGGER trg_dialer_wallets_updated BEFORE UPDATE ON public.dialer_wallets FOR EACH ROW EXECUTE FUNCTION public.crm_dialer_set_updated_at();

-- RLS + grants (acesso de admin por enquanto; escopo por tenant entra no próximo incremento)
ALTER TABLE public.dialer_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialer_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CRM admins manage dialer pricing" ON public.dialer_pricing;
CREATE POLICY "CRM admins manage dialer pricing" ON public.dialer_pricing FOR ALL USING (public.has_crm_access()) WITH CHECK (public.has_crm_access());
DROP POLICY IF EXISTS "CRM admins manage dialer wallets" ON public.dialer_wallets;
CREATE POLICY "CRM admins manage dialer wallets" ON public.dialer_wallets FOR ALL USING (public.has_crm_access()) WITH CHECK (public.has_crm_access());
DROP POLICY IF EXISTS "CRM admins manage dialer ledger" ON public.dialer_ledger;
CREATE POLICY "CRM admins manage dialer ledger" ON public.dialer_ledger FOR ALL USING (public.has_crm_access()) WITH CHECK (public.has_crm_access());
GRANT ALL ON public.dialer_pricing TO anon, authenticated, service_role;
GRANT ALL ON public.dialer_wallets TO anon, authenticated, service_role;
GRANT ALL ON public.dialer_ledger TO anon, authenticated, service_role;

-- preço padrão global (uma vez)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dialer_pricing WHERE tenant_id IS NULL) THEN
    INSERT INTO public.dialer_pricing (tenant_id) VALUES (NULL);
  END IF;
END $$;
