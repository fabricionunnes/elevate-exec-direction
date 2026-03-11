
DROP POLICY IF EXISTS "Admins can manage segments" ON public.company_segments;

CREATE POLICY "Staff can manage segments"
ON public.company_segments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);
