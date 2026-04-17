-- Garantir isolamento ESTRITO em onboarding_services:
-- Master UNV vê apenas serviços UNV (tenant_id IS NULL)
-- Cada WL vê apenas seus próprios serviços (tenant_id = seu)
-- Ninguém vê dados de outros tenants (nem o master)

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
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
  AND public.user_can_see_tenant_row(tenant_id)
);

CREATE POLICY "Admins can insert tenant services"
ON public.onboarding_services
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
      AND s.role IN ('admin','master')
  )
  AND public.user_can_see_tenant_row(tenant_id)
);

CREATE POLICY "Admins can update tenant services"
ON public.onboarding_services
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
      AND s.role IN ('admin','master')
  )
  AND public.user_can_see_tenant_row(tenant_id)
);

CREATE POLICY "Admins can delete tenant services"
ON public.onboarding_services
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
      AND s.role IN ('admin','master')
  )
  AND public.user_can_see_tenant_row(tenant_id)
);