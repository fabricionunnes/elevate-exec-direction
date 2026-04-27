-- Allow CRM staff with the granular 'tags_manage' permission to create/edit/delete tags

-- Helper that checks the current user has a specific CRM permission
CREATE OR REPLACE FUNCTION public.current_user_has_crm_permission(_permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
      AND os.is_active = true
      AND (
        os.role IN ('master', 'admin', 'head_comercial')
        OR EXISTS (
          SELECT 1 FROM public.crm_staff_permissions p
          WHERE p.staff_id = os.id
            AND p.permission_key = _permission
        )
      )
  )
$$;

-- Replace the management policy on crm_tags so users with tags_manage can CRUD
DROP POLICY IF EXISTS "CRM admins can manage tags" ON public.crm_tags;

CREATE POLICY "CRM users with tags_manage can manage tags"
ON public.crm_tags
FOR ALL
USING (public.current_user_has_crm_permission('tags_manage'))
WITH CHECK (public.current_user_has_crm_permission('tags_manage'));
