-- Add salesperson_id column to onboarding_users for linking vendedor role to company_salespeople
ALTER TABLE public.onboarding_users 
ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES public.company_salespeople(id) ON DELETE SET NULL;

-- Create a table to store menu permissions for each user
CREATE TABLE IF NOT EXISTS public.client_user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, menu_key)
);

-- Enable RLS
ALTER TABLE public.client_user_permissions ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_client_user_permissions_user_id ON public.client_user_permissions(user_id);

-- RLS Policies for client_user_permissions

-- Staff admins can manage all permissions
CREATE POLICY "Staff admins can manage all client permissions"
ON public.client_user_permissions
FOR ALL
USING (is_onboarding_admin());

-- Project members can view permissions in their project
CREATE POLICY "Project members can view client permissions"
ON public.client_user_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.id = client_user_permissions.user_id
    AND is_onboarding_project_member(ou.project_id)
  )
);

-- Gerente/Client users can manage permissions for users in their project
CREATE POLICY "Client managers can manage permissions in their project"
ON public.client_user_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users manager
    WHERE manager.user_id = auth.uid()
    AND manager.role IN ('client', 'gerente')
    AND EXISTS (
      SELECT 1 FROM public.onboarding_users target
      WHERE target.id = client_user_permissions.user_id
      AND target.project_id = manager.project_id
    )
  )
);

-- Create a function to check if a user has permission to a specific menu
CREATE OR REPLACE FUNCTION public.has_client_menu_permission(check_user_id UUID, check_menu_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.id = check_user_id
    AND (
      -- client and gerente roles have all permissions
      ou.role IN ('client', 'gerente')
      OR
      -- other roles check the permissions table
      EXISTS (
        SELECT 1 FROM public.client_user_permissions cup
        WHERE cup.user_id = check_user_id
        AND cup.menu_key = check_menu_key
      )
    )
  )
$$;

-- Update RLS on onboarding_users to allow clients/gerentes to manage users in their project
CREATE POLICY "Client managers can view users in their project"
ON public.onboarding_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users manager
    WHERE manager.user_id = auth.uid()
    AND manager.role IN ('client', 'gerente')
    AND manager.project_id = onboarding_users.project_id
  )
);

CREATE POLICY "Client managers can insert users in their project"
ON public.onboarding_users
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_users manager
    WHERE manager.user_id = auth.uid()
    AND manager.role IN ('client', 'gerente')
    AND manager.project_id = project_id
  )
);

CREATE POLICY "Client managers can update users in their project"
ON public.onboarding_users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users manager
    WHERE manager.user_id = auth.uid()
    AND manager.role IN ('client', 'gerente')
    AND manager.project_id = onboarding_users.project_id
  )
);

CREATE POLICY "Client managers can delete users in their project"
ON public.onboarding_users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users manager
    WHERE manager.user_id = auth.uid()
    AND manager.role IN ('client', 'gerente')
    AND manager.project_id = onboarding_users.project_id
  )
);