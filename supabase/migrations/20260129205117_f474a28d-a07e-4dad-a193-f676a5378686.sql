-- Fix has_hr_edit_access function to include 'master' role
CREATE OR REPLACE FUNCTION public.has_hr_edit_access(check_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role IN ('admin', 'consultant', 'cs', 'rh', 'master')
  )
  OR EXISTS (
    SELECT 1 FROM public.onboarding_companies oc
    JOIN public.onboarding_projects op ON op.onboarding_company_id = oc.id
    WHERE op.id = check_project_id
    AND (oc.consultant_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
         OR oc.cs_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true))
  )
$function$;

-- Also fix has_hr_view_access to include 'master' role
CREATE OR REPLACE FUNCTION public.has_hr_view_access(check_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Staff with edit access
  SELECT public.has_hr_edit_access(check_project_id)
  OR
  -- Client users can view
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = check_project_id
  )
$function$;