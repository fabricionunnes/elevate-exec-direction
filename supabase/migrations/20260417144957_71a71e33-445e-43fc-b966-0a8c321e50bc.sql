-- Recriar políticas do bucket whitelabel-assets para incluir CEO e
-- qualquer usuário autenticado em onboarding_staff ativo (sem exigir tenant_id).
DROP POLICY IF EXISTS "Tenant admins can upload whitelabel assets" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins can update whitelabel assets" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins can delete whitelabel assets" ON storage.objects;

CREATE POLICY "Staff can upload whitelabel assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'whitelabel-assets'
  AND (
    is_ceo()
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  )
);

CREATE POLICY "Staff can update whitelabel assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'whitelabel-assets'
  AND (
    is_ceo()
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  )
)
WITH CHECK (
  bucket_id = 'whitelabel-assets'
  AND (
    is_ceo()
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  )
);

CREATE POLICY "Staff can delete whitelabel assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'whitelabel-assets'
  AND (
    is_ceo()
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  )
);