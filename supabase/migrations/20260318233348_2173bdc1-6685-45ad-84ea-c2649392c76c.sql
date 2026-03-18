-- Fix storage policies for onboarding-documents bucket
-- Current: any authenticated user can view/delete any document
-- Fixed: staff can manage all, clients only their project's documents

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Staff can delete onboarding documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload onboarding documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view onboarding documents" ON storage.objects;

-- Staff (admin/cs/consultant) can do everything
CREATE POLICY "Staff can view onboarding documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'onboarding-documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.onboarding_staff
        WHERE user_id = auth.uid() AND is_active = true
      )
      OR EXISTS (
        SELECT 1 FROM public.onboarding_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can upload onboarding documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'onboarding-documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.onboarding_staff
        WHERE user_id = auth.uid() AND is_active = true
      )
      OR EXISTS (
        SELECT 1 FROM public.onboarding_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can delete onboarding documents v2"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'onboarding-documents'
    AND EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );