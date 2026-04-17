
-- 1) Adicionar tenant_id em whatsapp_instances
ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant ON public.whatsapp_instances(tenant_id);

-- Remover bloqueio total e aplicar isolamento por tenant
DROP POLICY IF EXISTS "Tenant isolation block" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Tenant isolation" ON public.whatsapp_instances;
CREATE POLICY "Tenant isolation" ON public.whatsapp_instances
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id());

-- 2) Garantir que tenant pode CRUD em suas próprias contas asaas
-- (a política RESTRICTIVE já existe; precisamos de uma PERMISSIVE para staff do tenant)
DROP POLICY IF EXISTS "Tenant staff manage own asaas" ON public.asaas_accounts;
CREATE POLICY "Tenant staff manage own asaas" ON public.asaas_accounts
  FOR ALL TO authenticated
  USING (tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id());

-- 3) Garantir que tenant pode CRUD em suas próprias instâncias whatsapp
DROP POLICY IF EXISTS "Tenant staff manage own whatsapp" ON public.whatsapp_instances;
CREATE POLICY "Tenant staff manage own whatsapp" ON public.whatsapp_instances
  FOR ALL TO authenticated
  USING (tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id());
