-- Permitir que admins de tenant white-label (registrados em onboarding_staff
-- com tenant_id) possam atualizar o branding do próprio tenant. Antes apenas
-- linhas em whitelabel_tenant_users eram reconhecidas, o que bloqueava o save.
CREATE OR REPLACE FUNCTION public.is_tenant_admin(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.whitelabel_tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = check_tenant_id
      AND role IN ('owner','admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.tenant_id = check_tenant_id
      AND s.role IN ('master','admin','owner')
  )
$function$;