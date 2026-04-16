CREATE POLICY "Staff can delete registrations"
ON public.staff_registrations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);