-- Add tenant_id to service_catalog and isolate by tenant
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_service_catalog_tenant_id
  ON public.service_catalog(tenant_id);

-- Auto-stamp tenant_id on insert based on the staff member creating the row
DROP TRIGGER IF EXISTS trg_set_tenant_id_service_catalog ON public.service_catalog;
CREATE TRIGGER trg_set_tenant_id_service_catalog
  BEFORE INSERT ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- Drop existing restrictive tenant policies if any (idempotent)
DROP POLICY IF EXISTS tenant_iso_select ON public.service_catalog;
DROP POLICY IF EXISTS tenant_iso_modify ON public.service_catalog;

-- SELECT: master sees only NULL-tenant rows; tenant staff see only their tenant; clients (no staff row) keep current access
CREATE POLICY tenant_iso_select ON public.service_catalog
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    CASE
      WHEN public.is_master_user() THEN tenant_id IS NULL
      WHEN public.current_user_tenant_id() IS NOT NULL THEN tenant_id = public.current_user_tenant_id()
      ELSE true
    END
  );

-- INSERT/UPDATE/DELETE: same isolation logic
CREATE POLICY tenant_iso_modify ON public.service_catalog
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    CASE
      WHEN public.is_master_user() THEN tenant_id IS NULL
      WHEN public.current_user_tenant_id() IS NOT NULL THEN tenant_id = public.current_user_tenant_id()
      ELSE true
    END
  )
  WITH CHECK (
    CASE
      WHEN public.is_master_user() THEN tenant_id IS NULL
      WHEN public.current_user_tenant_id() IS NOT NULL THEN tenant_id = public.current_user_tenant_id()
      ELSE true
    END
  );