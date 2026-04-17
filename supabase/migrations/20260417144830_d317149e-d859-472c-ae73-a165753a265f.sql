-- Expandir permissão de DELETE em whitelabel_tenants para qualquer master
-- da plataforma (staff sem tenant_id), além do CEO.
DROP POLICY IF EXISTS "CEO can delete tenants" ON public.whitelabel_tenants;

CREATE POLICY "Platform masters can delete tenants"
ON public.whitelabel_tenants
FOR DELETE
USING (
  is_ceo()
  OR EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.role = 'master'
      AND s.tenant_id IS NULL
  )
);