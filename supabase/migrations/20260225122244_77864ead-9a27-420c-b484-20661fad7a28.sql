
-- Fix: Add 'master' role to academy_lessons RLS policy
DROP POLICY IF EXISTS "Staff can manage lessons" ON public.academy_lessons;

CREATE POLICY "Staff can manage lessons"
ON public.academy_lessons
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.is_active = true
    AND onboarding_staff.role IN ('admin', 'cs', 'consultant', 'master')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.is_active = true
    AND onboarding_staff.role IN ('admin', 'cs', 'consultant', 'master')
  )
);
