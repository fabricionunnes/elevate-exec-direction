-- 1) Adicionar tenant_id
ALTER TABLE public.staff_financial_cost_centers
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_staff_financial_cost_centers_tenant
  ON public.staff_financial_cost_centers(tenant_id);

-- 2) Trigger auto-fill tenant_id
CREATE OR REPLACE FUNCTION public.set_staff_cost_center_tenant()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_set_staff_cost_center_tenant ON public.staff_financial_cost_centers;
CREATE TRIGGER trg_set_staff_cost_center_tenant
  BEFORE INSERT ON public.staff_financial_cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.set_staff_cost_center_tenant();

-- 3) RLS: substitui políticas antigas por isolamento por tenant
DROP POLICY IF EXISTS "Admins can manage cost centers" ON public.staff_financial_cost_centers;
DROP POLICY IF EXISTS "Authenticated can view cost centers" ON public.staff_financial_cost_centers;

CREATE POLICY "Tenant can view own cost centers"
ON public.staff_financial_cost_centers FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT DISTINCT FROM public.get_user_tenant_id()
  OR public.is_master_user()
);

CREATE POLICY "Tenant can insert own cost centers"
ON public.staff_financial_cost_centers FOR INSERT
TO authenticated
WITH CHECK (
  (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id())
  OR public.is_master_user()
);

CREATE POLICY "Tenant can update own cost centers"
ON public.staff_financial_cost_centers FOR UPDATE
TO authenticated
USING (
  tenant_id IS NOT DISTINCT FROM public.get_user_tenant_id()
  OR public.is_master_user()
)
WITH CHECK (
  tenant_id IS NOT DISTINCT FROM public.get_user_tenant_id()
  OR public.is_master_user()
);

CREATE POLICY "Tenant can delete own cost centers"
ON public.staff_financial_cost_centers FOR DELETE
TO authenticated
USING (
  tenant_id IS NOT DISTINCT FROM public.get_user_tenant_id()
  OR public.is_master_user()
);