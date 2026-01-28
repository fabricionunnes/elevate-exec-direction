
-- Recreate staff menu permissions table
CREATE TABLE IF NOT EXISTS public.staff_menu_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.onboarding_staff(id),
  UNIQUE(staff_id, menu_key)
);

-- Enable RLS
ALTER TABLE public.staff_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Master can manage staff permissions" ON public.staff_menu_permissions;
DROP POLICY IF EXISTS "Staff can view own permissions" ON public.staff_menu_permissions;

-- Only master can manage staff permissions
CREATE POLICY "Master can manage staff permissions"
ON public.staff_menu_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND role = 'master'
    AND is_active = true
  )
);

-- Staff can view their own permissions
CREATE POLICY "Staff can view own permissions"
ON public.staff_menu_permissions
FOR SELECT
USING (
  staff_id IN (
    SELECT id FROM public.onboarding_staff
    WHERE user_id = auth.uid()
  )
);

-- Create or replace function to check if user is master
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND role = 'master'
    AND is_active = true
  )
$$;

-- Create or replace function to check staff menu permission
CREATE OR REPLACE FUNCTION public.staff_has_menu_permission(check_staff_id uuid, check_menu_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.id = check_staff_id
    AND (
      os.role = 'master'
      OR
      EXISTS (
        SELECT 1 FROM public.staff_menu_permissions smp
        WHERE smp.staff_id = check_staff_id
        AND smp.menu_key = check_menu_key
      )
    )
  )
$$;

-- Grant all permissions to existing admins (so they keep access)
INSERT INTO public.staff_menu_permissions (staff_id, menu_key)
SELECT os.id, menu.key
FROM public.onboarding_staff os
CROSS JOIN (
  VALUES 
    ('dashboard'),
    ('companies'),
    ('tasks'),
    ('calendar'),
    ('announcements'),
    ('results'),
    ('crm'),
    ('hr'),
    ('circle'),
    ('academy'),
    ('financial'),
    ('ceo_dashboard'),
    ('settings'),
    ('admin_menu')
) AS menu(key)
WHERE os.role = 'admin' AND os.is_active = true
ON CONFLICT (staff_id, menu_key) DO NOTHING;
