
-- Permite INSERT/UPDATE/DELETE no bucket whitelabel-assets para staff autenticado
-- Pasta do tenant: whitelabel/{tenant_id}/...

CREATE POLICY "Tenant admins can upload whitelabel assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whitelabel-assets'
  AND (
    -- Master (sem tenant) pode tudo
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid() AND s.is_active = true
    )
  )
);

CREATE POLICY "Tenant admins can update whitelabel assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whitelabel-assets'
  AND EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
)
WITH CHECK (
  bucket_id = 'whitelabel-assets'
  AND EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
);

CREATE POLICY "Tenant admins can delete whitelabel assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'whitelabel-assets'
  AND EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
);
