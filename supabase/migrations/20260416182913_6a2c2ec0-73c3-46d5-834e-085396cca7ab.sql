DROP POLICY IF EXISTS "Anyone can update a pending registration" ON public.staff_registrations;

CREATE POLICY "Anyone can update a pending registration"
ON public.staff_registrations
FOR UPDATE
USING (status = 'pending')
WITH CHECK (status IN ('pending', 'submitted'));