-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert resumes" ON public.candidate_resumes;
DROP POLICY IF EXISTS "Users can view resumes" ON public.candidate_resumes;
DROP POLICY IF EXISTS "Public can upload candidate resumes" ON public.candidate_resumes;

-- Recreate SELECT policy - Staff and project members can view resumes
CREATE POLICY "Users can view resumes" ON public.candidate_resumes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.id = candidate_resumes.candidate_id
    AND (
      -- Staff with HR edit access
      has_hr_edit_access(c.project_id)
      OR
      -- Project members
      EXISTS (
        SELECT 1 FROM onboarding_users ou
        WHERE ou.user_id = auth.uid() AND ou.project_id = c.project_id
      )
    )
  )
);

-- Recreate INSERT policy - Staff and authenticated users can insert resumes
CREATE POLICY "Users can insert resumes" ON public.candidate_resumes
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.id = candidate_resumes.candidate_id
    AND (
      -- Staff with HR edit access
      has_hr_edit_access(c.project_id)
      OR
      -- Project members (clients) can upload for their project
      EXISTS (
        SELECT 1 FROM onboarding_users ou
        WHERE ou.user_id = auth.uid() AND ou.project_id = c.project_id
      )
    )
  )
);

-- Public can upload for open jobs (website applications)
CREATE POLICY "Public can upload candidate resumes" ON public.candidate_resumes
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM candidates c
    LEFT JOIN job_openings jo ON jo.id = c.job_opening_id
    WHERE c.id = candidate_resumes.candidate_id
    AND c.source = 'website'
    AND (jo.status = 'open' OR jo.id IS NULL)
  )
);