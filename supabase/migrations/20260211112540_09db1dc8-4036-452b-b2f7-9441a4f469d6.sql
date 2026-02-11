
-- Fix SELECT policy to include master
DROP POLICY IF EXISTS "Staff can view all hotseat responses" ON public.hotseat_responses;
CREATE POLICY "Staff can view all hotseat responses" ON public.hotseat_responses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.is_active = true
    AND onboarding_staff.role IN ('admin', 'master', 'cs')
  )
);

-- Fix UPDATE policy to include master
DROP POLICY IF EXISTS "Staff can update hotseat responses" ON public.hotseat_responses;
CREATE POLICY "Staff can update hotseat responses" ON public.hotseat_responses
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.is_active = true
    AND onboarding_staff.role IN ('admin', 'master', 'cs')
  )
);

-- Fix DELETE policy to include master
DROP POLICY IF EXISTS "Admin can delete hotseat responses" ON public.hotseat_responses;
CREATE POLICY "Admin and master can delete hotseat responses" ON public.hotseat_responses
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.is_active = true
    AND onboarding_staff.role IN ('admin', 'master')
  )
);
