-- Allow authenticated project members/assigned staff/admin to view assessment data

-- assessment_cycles
DROP POLICY IF EXISTS "Project members can view assessment cycles" ON public.assessment_cycles;
CREATE POLICY "Project members can view assessment cycles"
ON public.assessment_cycles
FOR SELECT
TO authenticated
USING (
  public.is_onboarding_admin()
  OR public.is_onboarding_project_member(project_id)
  OR public.is_onboarding_assigned_staff(project_id)
);

-- assessment_participants
DROP POLICY IF EXISTS "Project members can view assessment participants" ON public.assessment_participants;
CREATE POLICY "Project members can view assessment participants"
ON public.assessment_participants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_cycles ac
    WHERE ac.id = cycle_id
      AND (
        public.is_onboarding_admin()
        OR public.is_onboarding_project_member(ac.project_id)
        OR public.is_onboarding_assigned_staff(ac.project_id)
      )
  )
);

-- disc_responses
DROP POLICY IF EXISTS "Project members can view DISC responses" ON public.disc_responses;
CREATE POLICY "Project members can view DISC responses"
ON public.disc_responses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_cycles ac
    WHERE ac.id = cycle_id
      AND (
        public.is_onboarding_admin()
        OR public.is_onboarding_project_member(ac.project_id)
        OR public.is_onboarding_assigned_staff(ac.project_id)
      )
  )
);

-- assessment_360_evaluations
DROP POLICY IF EXISTS "Project members can view 360 evaluations" ON public.assessment_360_evaluations;
CREATE POLICY "Project members can view 360 evaluations"
ON public.assessment_360_evaluations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessment_cycles ac
    WHERE ac.id = cycle_id
      AND (
        public.is_onboarding_admin()
        OR public.is_onboarding_project_member(ac.project_id)
        OR public.is_onboarding_assigned_staff(ac.project_id)
      )
  )
);