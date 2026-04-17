CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
      AND role = 'master'
      AND is_active = true
      AND tenant_id IS NULL
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_staff
    WHERE user_id = auth.uid()
      AND email = 'fabricio@universidadevendas.com.br'
      AND is_active = true
      AND tenant_id IS NULL
  );
$function$;