
-- Tabela para armazenar inscrições self-service enquanto o pagamento não é confirmado
CREATE TABLE IF NOT EXISTS public.whitelabel_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Dados do cliente
  company_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  admin_phone TEXT,
  cpf_cnpj TEXT NOT NULL,
  -- Plano
  plan_slug TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  -- Asaas
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,
  payment_link TEXT,
  -- Status do funil
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','provisioned','failed','cancelled')),
  provisioned_tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE SET NULL,
  provisioning_error TEXT,
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  provisioned_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_whitelabel_signups_status ON public.whitelabel_signups(status);
CREATE INDEX IF NOT EXISTS idx_whitelabel_signups_payment ON public.whitelabel_signups(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_whitelabel_signups_subscription ON public.whitelabel_signups(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_whitelabel_signups_email ON public.whitelabel_signups(lower(admin_email));

ALTER TABLE public.whitelabel_signups ENABLE ROW LEVEL SECURITY;

-- Apenas o master/CEO pode visualizar/gerenciar (qualquer pessoa pode criar via edge function com service role)
DROP POLICY IF EXISTS "CEO can view signups" ON public.whitelabel_signups;
CREATE POLICY "CEO can view signups"
  ON public.whitelabel_signups FOR SELECT
  TO authenticated
  USING (is_ceo());

DROP POLICY IF EXISTS "CEO can update signups" ON public.whitelabel_signups;
CREATE POLICY "CEO can update signups"
  ON public.whitelabel_signups FOR UPDATE
  TO authenticated
  USING (is_ceo());

DROP POLICY IF EXISTS "CEO can delete signups" ON public.whitelabel_signups;
CREATE POLICY "CEO can delete signups"
  ON public.whitelabel_signups FOR DELETE
  TO authenticated
  USING (is_ceo());

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_whitelabel_signups_updated_at ON public.whitelabel_signups;
CREATE TRIGGER set_whitelabel_signups_updated_at
  BEFORE UPDATE ON public.whitelabel_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
