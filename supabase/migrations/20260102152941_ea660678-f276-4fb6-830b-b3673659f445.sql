-- Create a function to check if user is an onboarding admin (from staff table)
CREATE OR REPLACE FUNCTION public.is_onboarding_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
  )
$$;

-- Update onboarding_companies policies to use the new function
DROP POLICY IF EXISTS "Admins can manage companies" ON public.onboarding_companies;
CREATE POLICY "Admins can manage companies"
ON public.onboarding_companies
FOR ALL
USING (is_onboarding_admin());

-- Update onboarding_projects policies
DROP POLICY IF EXISTS "Portal members can create projects" ON public.onboarding_projects;
CREATE POLICY "Staff admins can create projects"
ON public.onboarding_projects
FOR INSERT
WITH CHECK (is_onboarding_admin());

-- Allow admins to update projects
CREATE POLICY "Staff admins can update projects"
ON public.onboarding_projects
FOR UPDATE
USING (is_onboarding_admin());

-- Allow admins to delete projects
CREATE POLICY "Staff admins can delete projects"
ON public.onboarding_projects
FOR DELETE
USING (is_onboarding_admin());

-- Allow admins to view all projects
DROP POLICY IF EXISTS "UNV admins can manage all projects" ON public.onboarding_projects;
CREATE POLICY "Staff admins can view all projects"
ON public.onboarding_projects
FOR SELECT
USING (is_onboarding_admin() OR is_onboarding_project_member(id));

-- Update onboarding_users policies to allow admins to manage users
DROP POLICY IF EXISTS "UNV admins can manage all onboarding users" ON public.onboarding_users;
CREATE POLICY "Staff admins can manage all onboarding users"
ON public.onboarding_users
FOR ALL
USING (is_onboarding_admin());

-- Update onboarding_tasks policies
DROP POLICY IF EXISTS "UNV admins can manage all tasks" ON public.onboarding_tasks;
CREATE POLICY "Staff admins can manage all tasks"
ON public.onboarding_tasks
FOR ALL
USING (is_onboarding_admin());

-- Update onboarding_tickets policies
DROP POLICY IF EXISTS "UNV admins can manage all tickets" ON public.onboarding_tickets;
CREATE POLICY "Staff admins can manage all tickets"
ON public.onboarding_tickets
FOR ALL
USING (is_onboarding_admin());

-- Update onboarding_ticket_replies policies
DROP POLICY IF EXISTS "UNV admins can manage all replies" ON public.onboarding_ticket_replies;
CREATE POLICY "Staff admins can manage all replies"
ON public.onboarding_ticket_replies
FOR ALL
USING (is_onboarding_admin());