
-- Table to store which menus are enabled per project for client users
-- If no rows exist for a project, ALL menus are available (backward compatible)
CREATE TABLE public.project_menu_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, menu_key)
);

-- Enable RLS
ALTER TABLE public.project_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Staff (admin/master) can manage project menu permissions
CREATE POLICY "Staff can view project menu permissions"
ON public.project_menu_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_users
    WHERE user_id = auth.uid() AND project_id = project_menu_permissions.project_id
  )
);

CREATE POLICY "Admin/master can manage project menu permissions"
ON public.project_menu_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('master', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('master', 'admin')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_project_menu_permissions_updated_at
BEFORE UPDATE ON public.project_menu_permissions
FOR EACH ROW
EXECUTE FUNCTION public.portal_update_updated_at();
