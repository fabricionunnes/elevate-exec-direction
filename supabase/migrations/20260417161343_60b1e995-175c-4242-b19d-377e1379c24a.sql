-- Restringe a visão global apenas ao master UNV global (por email),
-- removendo a brecha que liberava todos os masters de tenants WL a verem
-- os serviços do tenant principal.

DROP POLICY IF EXISTS "Staff can view tenant services" ON public.onboarding_services;
DROP POLICY IF EXISTS "Admins can insert tenant services" ON public.onboarding_services;
DROP POLICY IF EXISTS "Admins can update tenant services" ON public.onboarding_services;
DROP POLICY IF EXISTS "Admins can delete tenant services" ON public.onboarding_services;

CREATE POLICY "Staff can view tenant services"
ON public.onboarding_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND (
        s.email = 'fabricio@universidadevendas.com.br'
        OR s.tenant_id IS NOT DISTINCT FROM onboarding_services.tenant_id
      )
  )
);

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
        s.email = 'fabricio@universidadevendas.com.br'
        OR s.tenant_id IS NOT DISTINCT FROM onboarding_services.tenant_id
      )
  )
);

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
        s.email = 'fabricio@universidadevendas.com.br'
        OR s.tenant_id IS NOT DISTINCT FROM onboarding_services.tenant_id
      )
  )
);

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
        s.email = 'fabricio@universidadevendas.com.br'
        OR s.tenant_id IS NOT DISTINCT FROM onboarding_services.tenant_id
      )
  )
);

-- Trigger para preencher tenant_id automaticamente em novos serviços,
-- baseado no tenant do staff que está criando.
CREATE OR REPLACE FUNCTION public.fill_onboarding_service_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_email text;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id, email INTO v_tenant, v_email
    FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    LIMIT 1;

    -- Master UNV global mantém tenant_id NULL (serviços globais)
    IF v_email <> 'fabricio@universidadevendas.com.br' THEN
      NEW.tenant_id := v_tenant;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_onboarding_service_tenant_id ON public.onboarding_services;
CREATE TRIGGER trg_fill_onboarding_service_tenant_id
BEFORE INSERT ON public.onboarding_services
FOR EACH ROW
EXECUTE FUNCTION public.fill_onboarding_service_tenant_id();