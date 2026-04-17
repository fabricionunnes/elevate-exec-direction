-- Função SECURITY DEFINER para resolver o tenant_id do usuário logado
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.onboarding_staff
       WHERE user_id = auth.uid() AND is_active = true LIMIT 1),
    (SELECT tenant_id FROM public.onboarding_users
       WHERE user_id = auth.uid() LIMIT 1)
  )
$$;

-- Helper para checar match de tenant (NULL = NULL conta como match)
CREATE OR REPLACE FUNCTION public.tenant_matches(_row_tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _row_tenant IS NOT DISTINCT FROM public.current_user_tenant_id()
$$;

-- Aplicar política de isolamento por tenant em cada tabela com tenant_id
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'crm_leads','crm_pipelines','crm_stages',
    'financial_payables','financial_receivables',
    'kpi_salespeople',
    'onboarding_companies','onboarding_projects',
    'onboarding_staff','onboarding_users'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Tenant isolation" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.tenant_matches(tenant_id)) WITH CHECK (public.tenant_matches(tenant_id))',
      t
    );
  END LOOP;
END $$;