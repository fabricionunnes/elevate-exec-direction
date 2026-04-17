-- 1) Adicionar tenant_id em api_keys
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS tenant_id uuid NULL REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;

-- 2) Trigger para auto-preencher tenant_id e created_by no INSERT
CREATE OR REPLACE FUNCTION public.fill_api_key_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff record;
BEGIN
  SELECT id, tenant_id INTO _staff
  FROM public.onboarding_staff
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF _staff.id IS NOT NULL THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := _staff.id;
    END IF;
    -- Se não veio tenant_id explícito, usa o tenant do staff que está criando
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := _staff.tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_api_key_tenant ON public.api_keys;
CREATE TRIGGER trg_fill_api_key_tenant
  BEFORE INSERT ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_api_key_tenant();

-- 3) RLS: cada tenant vê apenas suas chaves; master vê apenas chaves UNV (tenant_id NULL)
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view tenant api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can insert tenant api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can update tenant api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can delete tenant api_keys" ON public.api_keys;

CREATE POLICY "Staff can view tenant api_keys"
ON public.api_keys
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
  AND public.user_can_see_tenant_row(tenant_id)
);

CREATE POLICY "Admins can insert tenant api_keys"
ON public.api_keys
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
      AND s.role IN ('admin','master')
  )
  AND public.user_can_see_tenant_row(tenant_id)
);

CREATE POLICY "Admins can update tenant api_keys"
ON public.api_keys
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
      AND s.role IN ('admin','master')
  )
  AND public.user_can_see_tenant_row(tenant_id)
);

CREATE POLICY "Admins can delete tenant api_keys"
ON public.api_keys
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
      AND s.role IN ('admin','master')
  )
  AND public.user_can_see_tenant_row(tenant_id)
);