CREATE OR REPLACE FUNCTION public.current_profile_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pe.id
  FROM public.profile_employees pe
  JOIN public.onboarding_staff os ON os.id = pe.staff_id
  WHERE os.user_id = auth.uid()
    AND pe.tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id()
  ORDER BY pe.created_at ASC
  LIMIT 1;
$$;