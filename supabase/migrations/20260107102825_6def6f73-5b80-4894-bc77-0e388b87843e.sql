-- Allow admins to delete assessment data

-- assessment_cycles - admin can delete
DROP POLICY IF EXISTS "Admins can delete assessment cycles" ON public.assessment_cycles;
CREATE POLICY "Admins can delete assessment cycles"
ON public.assessment_cycles
FOR DELETE
TO authenticated
USING (public.is_onboarding_admin());

-- assessment_participants - admin can delete
DROP POLICY IF EXISTS "Admins can delete assessment participants" ON public.assessment_participants;
CREATE POLICY "Admins can delete assessment participants"
ON public.assessment_participants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_cycles ac
    WHERE ac.id = cycle_id
      AND public.is_onboarding_admin()
  )
);

-- disc_responses - admin can delete
DROP POLICY IF EXISTS "Admins can delete DISC responses" ON public.disc_responses;
CREATE POLICY "Admins can delete DISC responses"
ON public.disc_responses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_cycles ac
    WHERE ac.id = cycle_id
      AND public.is_onboarding_admin()
  )
);

-- assessment_360_evaluations - admin can delete
DROP POLICY IF EXISTS "Admins can delete 360 evaluations" ON public.assessment_360_evaluations;
CREATE POLICY "Admins can delete 360 evaluations"
ON public.assessment_360_evaluations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_cycles ac
    WHERE ac.id = cycle_id
      AND public.is_onboarding_admin()
  )
);