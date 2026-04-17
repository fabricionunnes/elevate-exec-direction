-- Trigger: ao inserir/atualizar onboarding_users, preencher tenant_id automaticamente
-- a partir do tenant_id do projeto vinculado. Isso garante que o admin do tenant
-- white-label consiga ver os usuários criados (RLS por tenant_id).

CREATE OR REPLACE FUNCTION public.fill_onboarding_user_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.onboarding_projects
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_onboarding_user_tenant_id ON public.onboarding_users;

CREATE TRIGGER trg_fill_onboarding_user_tenant_id
  BEFORE INSERT OR UPDATE OF project_id ON public.onboarding_users
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_onboarding_user_tenant_id();

-- Backfill: corrigir registros existentes com tenant_id NULL cujo projeto tem tenant_id
UPDATE public.onboarding_users u
SET tenant_id = p.tenant_id
FROM public.onboarding_projects p
WHERE u.project_id = p.id
  AND u.tenant_id IS NULL
  AND p.tenant_id IS NOT NULL;