-- Drop and recreate the candidate insertion policy to be more comprehensive
DROP POLICY IF EXISTS "Staff can insert candidates" ON public.candidates;
DROP POLICY IF EXISTS "Clients can create candidates" ON public.candidates;

-- Create a unified insert policy that works for both staff and clients
CREATE POLICY "Authenticated users can insert candidates" ON public.candidates
  FOR INSERT WITH CHECK (
    -- Staff users (admin, consultant, cs, rh) can insert for any project they have access to
    public.has_hr_edit_access(project_id)
    OR
    -- Client users can insert for their own project
    EXISTS (
      SELECT 1 FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.project_id = candidates.project_id
    )
  );

-- Also ensure hiring history can be created properly
DROP POLICY IF EXISTS "Clients can create hiring history" ON public.hiring_history;
DROP POLICY IF EXISTS "Staff can insert hiring history" ON public.hiring_history;

CREATE POLICY "Authenticated users can insert hiring history" ON public.hiring_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = hiring_history.candidate_id
      AND (
        public.has_hr_edit_access(c.project_id)
        OR
        EXISTS (
          SELECT 1 FROM public.onboarding_users ou
          WHERE ou.user_id = auth.uid()
          AND ou.project_id = c.project_id
        )
      )
    )
  );