
-- 1) Adicionar coluna tenant_id
ALTER TABLE public.financial_suppliers
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- 2) Backfill: fornecedores existentes ficam com o tenant master (NULL = master/UNV original)
-- Mantemos NULL para os existentes, considerando-os do tenant master.

-- 3) Trigger para auto-preencher tenant_id no insert
CREATE OR REPLACE FUNCTION public.set_financial_supplier_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_user_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_financial_supplier_tenant ON public.financial_suppliers;
CREATE TRIGGER trg_set_financial_supplier_tenant
  BEFORE INSERT ON public.financial_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_financial_supplier_tenant();

-- 4) Atualizar políticas RLS: dropar a antiga e criar isoladas por tenant
DROP POLICY IF EXISTS "Financial admins can manage suppliers" ON public.financial_suppliers;

-- Master (fabricio@) tem acesso global
CREATE POLICY "Master full access to suppliers"
ON public.financial_suppliers
FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

-- Staff financeiros enxergam/gerenciam apenas fornecedores do seu próprio tenant
CREATE POLICY "Tenant staff can view own suppliers"
ON public.financial_suppliers
FOR SELECT
USING (
  tenant_id IS NOT DISTINCT FROM public.get_user_tenant_id()
);

CREATE POLICY "Tenant staff can insert own suppliers"
ON public.financial_suppliers
FOR INSERT
WITH CHECK (
  public.get_user_tenant_id() IS NOT NULL
  AND (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id())
);

CREATE POLICY "Tenant staff can update own suppliers"
ON public.financial_suppliers
FOR UPDATE
USING (tenant_id IS NOT DISTINCT FROM public.get_user_tenant_id())
WITH CHECK (tenant_id IS NOT DISTINCT FROM public.get_user_tenant_id());

CREATE POLICY "Tenant staff can delete own suppliers"
ON public.financial_suppliers
FOR DELETE
USING (tenant_id IS NOT DISTINCT FROM public.get_user_tenant_id());
