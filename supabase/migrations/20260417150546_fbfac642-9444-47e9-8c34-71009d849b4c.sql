DROP POLICY IF EXISTS "Tenant admins can update their tenant" ON public.whitelabel_tenants;

CREATE POLICY "Tenant admins or platform masters can update tenant"
ON public.whitelabel_tenants
FOR UPDATE
TO authenticated
USING (
  is_tenant_admin(id)
  OR is_ceo()
  OR EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.role = 'master'
      AND s.tenant_id IS NULL
  )
)
WITH CHECK (
  is_tenant_admin(id)
  OR is_ceo()
  OR EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.role = 'master'
      AND s.tenant_id IS NULL
  )
);