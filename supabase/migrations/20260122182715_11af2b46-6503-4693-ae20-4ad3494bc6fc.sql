-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Client managers can view users in their project" ON public.onboarding_users;
DROP POLICY IF EXISTS "Client managers can insert users in their project" ON public.onboarding_users;
DROP POLICY IF EXISTS "Client managers can update users in their project" ON public.onboarding_users;
DROP POLICY IF EXISTS "Client managers can delete users in their project" ON public.onboarding_users;

-- Create a SECURITY DEFINER function to safely get the current user's project
-- This bypasses RLS during execution, breaking the recursion
CREATE OR REPLACE FUNCTION public.get_current_client_project()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.onboarding_users
  WHERE user_id = auth.uid()
  AND role IN ('client', 'gerente')
  LIMIT 1
$$;

-- Recreate the policies using the safe function
CREATE POLICY "Client managers can view users in their project"
ON public.onboarding_users FOR SELECT
USING (
  project_id = public.get_current_client_project()
);

CREATE POLICY "Client managers can insert users in their project"
ON public.onboarding_users FOR INSERT
WITH CHECK (
  project_id = public.get_current_client_project()
);

CREATE POLICY "Client managers can update users in their project"
ON public.onboarding_users FOR UPDATE
USING (
  project_id = public.get_current_client_project()
);

CREATE POLICY "Client managers can delete users in their project"
ON public.onboarding_users FOR DELETE
USING (
  project_id = public.get_current_client_project()
);