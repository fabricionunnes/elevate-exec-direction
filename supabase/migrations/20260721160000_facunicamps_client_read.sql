-- Dashboard Facunicamps zerado no portal do cliente (/onboarding-client):
-- as tabelas facunicamps_* só tinham policy de staff UNV (sec_staff_unv_all);
-- usuário cliente (onboarding_users role=client, ex.: Gabriel) caía na RLS e
-- via tudo vazio. Libera SELECT pra usuários vinculados a projeto da empresa
-- Facunicamps. (Aplicado direto em prod em 2026-07-21.)

DO $mig$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'facunicamps_matriculas',
    'facunicamps_metas',
    'facunicamps_metas_vendedor',
    'facunicamps_sync_runs'
  ] LOOP
    EXECUTE format($p$ DROP POLICY IF EXISTS sec_client_facunicamps_read ON public.%I $p$, t);
    EXECUTE format($p$
      CREATE POLICY sec_client_facunicamps_read ON public.%I
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM public.onboarding_users ou
        JOIN public.onboarding_projects p ON p.id = ou.project_id
        WHERE ou.user_id = auth.uid()
          AND COALESCE(p.onboarding_company_id, p.company_id) = '1081cb78-bd6c-42b2-8a85-104ead3ecc18'::uuid
      ))
    $p$, t);
  END LOOP;
END $mig$;
