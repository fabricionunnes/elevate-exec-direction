
-- Add tenant_id to onboarding_services for white-label isolation
ALTER TABLE public.onboarding_services
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_onboarding_services_tenant_id
  ON public.onboarding_services(tenant_id);

COMMENT ON COLUMN public.onboarding_services.tenant_id IS
  'Tenant white-label dono do serviço. NULL = serviços do master (UNV). Cada tenant vê e cria apenas os seus.';

-- Drop existing SELECT policies and recreate with tenant isolation
DROP POLICY IF EXISTS "Staff can view services" ON public.onboarding_services;
DROP POLICY IF EXISTS "Admins can manage services" ON public.onboarding_services;

-- SELECT: staff vê apenas serviços do seu tenant (ou master vê tudo)
CREATE POLICY "Staff can view tenant services"
  ON public.onboarding_services
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND (
          -- Master vê todos
          s.role = 'master'
          OR s.email = 'fabricio@universidadevendas.com.br'
          -- Outros: vê do seu tenant (NULL=master) ou serviços do master quando tenant_id IS NULL e staff também é master
          OR (s.tenant_id IS NOT DISTINCT FROM onboarding_services.tenant_id)
        )
    )
  );

-- INSERT: admins criam serviços vinculados ao seu tenant
CREATE POLICY "Admins can insert tenant services"
  ON public.onboarding_services
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.role IN ('admin','master')
        AND (
          s.role = 'master'
          OR s.email = 'fabricio@universidadevendas.com.br'
          OR s.tenant_id IS NOT DISTINCT FROM onboarding_services.tenant_id
        )
    )
  );

-- UPDATE
CREATE POLICY "Admins can update tenant services"
  ON public.onboarding_services
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.role IN ('admin','master')
        AND (
          s.role = 'master'
          OR s.email = 'fabricio@universidadevendas.com.br'
          OR s.tenant_id IS NOT DISTINCT FROM onboarding_services.tenant_id
        )
    )
  );

-- DELETE
CREATE POLICY "Admins can delete tenant services"
  ON public.onboarding_services
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.role IN ('admin','master')
        AND (
          s.role = 'master'
          OR s.email = 'fabricio@universidadevendas.com.br'
          OR s.tenant_id IS NOT DISTINCT FROM onboarding_services.tenant_id
        )
    )
  );

-- Trigger para preencher tenant_id automaticamente no INSERT a partir do staff do usuário
CREATE OR REPLACE FUNCTION public.set_onboarding_service_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_role text;
  v_email text;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.tenant_id, s.role, s.email
    INTO v_tenant, v_role, v_email
  FROM public.onboarding_staff s
  WHERE s.user_id = auth.uid() AND s.is_active = true
  LIMIT 1;

  -- Master cria sempre como NULL (serviços globais), demais herdam o tenant do staff
  IF v_role = 'master' OR v_email = 'fabricio@universidadevendas.com.br' THEN
    NEW.tenant_id := NULL;
  ELSE
    NEW.tenant_id := v_tenant;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_onboarding_service_tenant_trigger ON public.onboarding_services;
CREATE TRIGGER set_onboarding_service_tenant_trigger
  BEFORE INSERT ON public.onboarding_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_onboarding_service_tenant();
