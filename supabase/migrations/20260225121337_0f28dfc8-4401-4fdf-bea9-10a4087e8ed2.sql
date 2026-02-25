-- Fix: Add 'master' role to academy_tracks RLS policy
DROP POLICY IF EXISTS "Staff can manage tracks" ON public.academy_tracks;

CREATE POLICY "Staff can manage tracks"
ON public.academy_tracks
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