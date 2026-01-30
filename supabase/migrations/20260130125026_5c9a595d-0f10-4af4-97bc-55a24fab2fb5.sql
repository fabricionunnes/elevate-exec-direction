-- Create CRM granular permissions table
CREATE TABLE public.crm_staff_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(staff_id, permission_key)
);

-- Enable RLS
ALTER TABLE public.crm_staff_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins/master can manage
CREATE POLICY "Staff can view their own permissions"
ON public.crm_staff_permissions
FOR SELECT
USING (
  staff_id = public.get_current_staff_id()
  OR EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('master', 'admin', 'head_comercial')
  )
);

CREATE POLICY "Admins can manage CRM permissions"
ON public.crm_staff_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('master', 'admin', 'head_comercial')
  )
);

-- Create helper function to check CRM permission
CREATE OR REPLACE FUNCTION public.has_crm_permission(check_staff_id UUID, check_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.id = check_staff_id
    AND os.is_active = true
    AND (
      -- Master and admin always have all permissions
      os.role IN ('master', 'admin')
      OR
      -- Check specific permission
      EXISTS (
        SELECT 1 FROM public.crm_staff_permissions
        WHERE staff_id = check_staff_id
        AND permission_key = check_permission
      )
    )
  )
$$;

-- Add index for performance
CREATE INDEX idx_crm_staff_permissions_staff ON public.crm_staff_permissions(staff_id);
CREATE INDEX idx_crm_staff_permissions_key ON public.crm_staff_permissions(permission_key);