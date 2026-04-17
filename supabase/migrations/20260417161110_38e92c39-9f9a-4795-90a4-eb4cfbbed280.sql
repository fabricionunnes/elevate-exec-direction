-- Trigger: ao inserir onboarding_companies sem tenant_id, herdar do staff criador
CREATE OR REPLACE FUNCTION public.fill_onboarding_company_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT s.tenant_id INTO NEW.tenant_id
    FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_onboarding_company_tenant_id ON public.onboarding_companies;
CREATE TRIGGER trg_fill_onboarding_company_tenant_id
  BEFORE INSERT ON public.onboarding_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_onboarding_company_tenant_id();

-- Backfill: empresas órfãs criadas por staff WL → herdar do projeto vinculado
UPDATE public.onboarding_companies c
SET tenant_id = p.tenant_id
FROM public.onboarding_projects p
WHERE p.onboarding_company_id = c.id
  AND c.tenant_id IS NULL
  AND p.tenant_id IS NOT NULL;