
-- Fix is_onboarding_admin function to check onboarding_staff table instead of onboarding_users
CREATE OR REPLACE FUNCTION public.is_onboarding_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
  )
$function$;
