-- Trigger de proteção: impede criar projeto se tenant white-label estiver no limite

CREATE OR REPLACE FUNCTION public.enforce_tenant_project_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_max int;
  v_count int;
  v_name text;
BEGIN
  -- Resolver tenant_id: prioriza o do projeto; se nulo, deriva do staff criador
  v_tenant_id := NEW.tenant_id;

  IF v_tenant_id IS NULL THEN
    SELECT s.tenant_id INTO v_tenant_id
    FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
    LIMIT 1;
  END IF;

  -- Sem tenant (master UNV) → sem limite
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Atribui tenant_id se vazio
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_tenant_id;
  END IF;

  SELECT max_active_projects, name INTO v_max, v_name
  FROM public.whitelabel_tenants
  WHERE id = v_tenant_id;

  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.onboarding_projects
  WHERE tenant_id = v_tenant_id
    AND status = 'active';

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Limite de projetos do plano atingido (%/% ativos para %). Faça upgrade para adicionar mais.',
      v_count, v_max, v_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tenant_project_limit ON public.onboarding_projects;

CREATE TRIGGER trg_enforce_tenant_project_limit
  BEFORE INSERT ON public.onboarding_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_project_limit();