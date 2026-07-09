-- Bucket de imagens do Manual de Processos (prints reais das telas, fotos de evento etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('staff-processes', 'staff-processes', true, 8388608, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Upload/remoção: só master/admin da UNV (mesma regra de escrita dos processos)
CREATE POLICY "Master e admin sobem imagens do manual"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'staff-processes'
    AND EXISTS (
      SELECT 1 FROM onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true AND tenant_id IS NULL
        AND role IN ('master','admin')
    )
  );

CREATE POLICY "Master e admin removem imagens do manual"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'staff-processes'
    AND EXISTS (
      SELECT 1 FROM onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true AND tenant_id IS NULL
        AND role IN ('master','admin')
    )
  );

-- Upsert do storage exige SELECT e UPDATE além do INSERT
CREATE POLICY "Imagens do manual legiveis por autenticados"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'staff-processes');

CREATE POLICY "Master e admin atualizam imagens do manual"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'staff-processes'
    AND EXISTS (
      SELECT 1 FROM onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true AND tenant_id IS NULL
        AND role IN ('master','admin')
    )
  );
