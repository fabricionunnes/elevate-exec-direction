-- Remove duplicatas mantendo o registro mais recente por staff_id
DELETE FROM public.profile_employees
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY staff_id ORDER BY created_at DESC) AS rn
    FROM public.profile_employees
    WHERE staff_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Adiciona índice único parcial em staff_id (só para não-nulos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_employees_staff_id
  ON public.profile_employees (staff_id)
  WHERE staff_id IS NOT NULL;

-- Corrige o trigger para usar o conflict target correto
CREATE OR REPLACE FUNCTION public.sync_staff_to_profile_employee()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profile_employees
    SET status = 'terminated', is_employee = false, updated_at = now()
    WHERE staff_id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.profile_employees (
    tenant_id, staff_id, user_id, full_name, email, phone, avatar_url, employee_type, status, is_employee
  )
  VALUES (
    NEW.tenant_id, NEW.id, NEW.user_id, NEW.name, NEW.email, NEW.phone, NEW.avatar_url,
    'internal',
    CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END,
    true
  )
  ON CONFLICT (staff_id) DO UPDATE
    SET full_name  = EXCLUDED.full_name,
        email      = EXCLUDED.email,
        phone      = EXCLUDED.phone,
        avatar_url = EXCLUDED.avatar_url,
        tenant_id  = EXCLUDED.tenant_id,
        user_id    = EXCLUDED.user_id,
        status     = CASE
                       WHEN NEW.is_active THEN COALESCE(NULLIF(profile_employees.status, 'inactive'), 'active')
                       ELSE 'inactive'
                     END,
        updated_at = now();

  RETURN NEW;
END;
$$;
