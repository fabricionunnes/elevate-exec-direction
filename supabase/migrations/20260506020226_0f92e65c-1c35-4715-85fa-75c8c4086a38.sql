CREATE OR REPLACE FUNCTION public.fill_api_key_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _staff record;
BEGIN
  SELECT id, tenant_id INTO _staff
  FROM public.onboarding_staff
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  IF _staff.id IS NOT NULL AND NEW.tenant_id IS NULL THEN
    NEW.tenant_id := _staff.tenant_id;
  END IF;

  RETURN NEW;
END;
$function$;