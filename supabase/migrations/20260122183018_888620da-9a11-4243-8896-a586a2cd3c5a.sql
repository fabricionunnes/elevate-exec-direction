-- Drop the conflicting policy and recreate
DROP POLICY IF EXISTS "Project members can view users in their project" ON public.onboarding_users;

-- Recreate the SELECT policy
CREATE POLICY "Project members can view users in their project"
ON public.onboarding_users FOR SELECT
USING (
  project_id = public.get_current_client_project()
);