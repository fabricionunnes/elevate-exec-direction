-- 1. Adicionar tenant_id à tabela financial_banks
ALTER TABLE public.financial_banks
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_financial_banks_tenant_id ON public.financial_banks(tenant_id);

-- 2. Trigger para preencher tenant_id automaticamente no insert (usa o padrão existente)
DROP TRIGGER IF EXISTS trg_set_tenant_financial_banks ON public.financial_banks;
CREATE TRIGGER trg_set_tenant_financial_banks
  BEFORE INSERT ON public.financial_banks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- 3. Substituir a política permissiva por isolamento por tenant
DROP POLICY IF EXISTS "Allow all for financial_banks" ON public.financial_banks;

-- Master (tenant_id IS NULL no staff) vê apenas bancos sem tenant (do principal/UNV)
-- Staff de tenant WL vê apenas bancos do próprio tenant
CREATE POLICY "Tenant isolation select financial_banks"
  ON public.financial_banks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND (
          -- Mesmo tenant
          (s.tenant_id IS NOT DISTINCT FROM financial_banks.tenant_id)
          -- Master global (sem tenant) vê tudo
          OR (s.tenant_id IS NULL AND s.role = 'master')
        )
    )
  );

CREATE POLICY "Tenant isolation insert financial_banks"
  ON public.financial_banks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND (
          (s.tenant_id IS NOT DISTINCT FROM financial_banks.tenant_id)
          OR (s.tenant_id IS NULL AND s.role = 'master')
        )
    )
  );

CREATE POLICY "Tenant isolation update financial_banks"
  ON public.financial_banks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND (
          (s.tenant_id IS NOT DISTINCT FROM financial_banks.tenant_id)
          OR (s.tenant_id IS NULL AND s.role = 'master')
        )
    )
  );

CREATE POLICY "Tenant isolation delete financial_banks"
  ON public.financial_banks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND (
          (s.tenant_id IS NOT DISTINCT FROM financial_banks.tenant_id)
          OR (s.tenant_id IS NULL AND s.role = 'master')
        )
    )
  );