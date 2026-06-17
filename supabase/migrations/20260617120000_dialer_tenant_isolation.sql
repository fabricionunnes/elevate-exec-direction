-- ============ DISCADOR SaaS: isolamento por tenant ============
-- Regra: cliente (usuário com tenant) vê SÓ o tenant dele.
--        staff UNV (sem tenant) com acesso ao CRM vê tudo (gestão dos clientes).
-- Edge functions usam service role e ignoram RLS (continuam funcionando).

-- Helper: tenant do usuário logado (NULL = staff UNV/owner)
CREATE OR REPLACE FUNCTION public.dialer_current_tenant()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.whitelabel_tenant_users WHERE user_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.dialer_current_tenant() TO anon, authenticated, service_role;

-- tenant_id na fila e nas sessões (backfill a partir da campanha)
ALTER TABLE public.crm_dialer_queue ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id);
UPDATE public.crm_dialer_queue q SET tenant_id = c.tenant_id
  FROM public.crm_dialer_campaigns c WHERE q.campaign_id = c.id AND q.tenant_id IS NULL AND c.tenant_id IS NOT NULL;
ALTER TABLE public.crm_dialer_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id);
UPDATE public.crm_dialer_sessions s SET tenant_id = c.tenant_id
  FROM public.crm_dialer_campaigns c WHERE s.campaign_id = c.id AND s.tenant_id IS NULL AND c.tenant_id IS NOT NULL;

-- Groundwork: tenant_id em crm_leads (SEM mexer na RLS atual do CRM — feito no incremento 4)
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id);

-- Políticas tenant-aware nas tabelas do discador
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_dialer_campaigns','crm_dialer_queue','crm_calls','crm_dialer_sessions',
    'dialer_wallets','dialer_ledger','dialer_recharges'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_scope_'||t, t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR ALL
      USING (
        (public.dialer_current_tenant() IS NOT NULL AND tenant_id = public.dialer_current_tenant())
        OR (public.dialer_current_tenant() IS NULL AND public.has_crm_access())
      )
      WITH CHECK (
        (public.dialer_current_tenant() IS NOT NULL AND tenant_id = public.dialer_current_tenant())
        OR (public.dialer_current_tenant() IS NULL AND public.has_crm_access())
      )
    $f$, 'tenant_scope_'||t, t);
  END LOOP;
END $$;

-- Remove as políticas antigas só-admin (substituídas pelas tenant-aware acima)
DROP POLICY IF EXISTS "CRM users manage dialer campaigns" ON public.crm_dialer_campaigns;
DROP POLICY IF EXISTS "CRM users manage dialer queue" ON public.crm_dialer_queue;
DROP POLICY IF EXISTS "CRM users manage calls" ON public.crm_calls;
DROP POLICY IF EXISTS "CRM users manage dialer sessions" ON public.crm_dialer_sessions;
DROP POLICY IF EXISTS "CRM admins manage dialer wallets" ON public.dialer_wallets;
DROP POLICY IF EXISTS "CRM admins manage dialer ledger" ON public.dialer_ledger;
DROP POLICY IF EXISTS "CRM users manage dialer recharges" ON public.dialer_recharges;
