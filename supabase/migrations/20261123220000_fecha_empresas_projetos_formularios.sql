-- Segurança, etapa 2 (parte 6): fecha pra visitante as tabelas que as páginas públicas
-- já deixaram de ler direto (migrações 20261123210000 e 20261123213000):
-- empresas, projetos, modelos de tarefa, formulários de consultoria e resultados de DISC.
-- Pra quem está logado nada muda: a mesma regra passa a valer só com login.

insert into public.zz_rls_etapa2_20261123 (tablename, policyname, permissive, cmd, roles, qual, with_check)
select p.tablename, p.policyname, p.permissive, p.cmd, p.roles::text[], p.qual, p.with_check
from pg_policies p
where p.schemaname = 'public'
  and (p.tablename, p.policyname) in (
    ('onboarding_companies', 'Anyone can view company name for NPS'),
    ('onboarding_companies', 'onboarding_companies_anon_names'),
    ('onboarding_projects', 'Anyone can view project info for NPS'),
    ('onboarding_task_templates', 'Anyone can view task templates'),
    ('financial_consultation_forms', 'public_read_financial_by_token'),
    ('financial_consultation_forms', 'public_update_financial_by_token'),
    ('marketing_consultation_forms', 'public_read_marketing_by_token'),
    ('marketing_consultation_forms', 'public_update_marketing_by_token'),
    ('traffic_analysis_forms', 'Public access via token'),
    ('traffic_analysis_forms', 'Public can update via token'),
    ('candidate_disc_results', 'Candidates can view their disc via token'),
    ('candidate_disc_results', 'Public can update pending disc via token')
  )
  and not exists (select 1 from public.zz_rls_etapa2_20261123 z where z.tablename = p.tablename and z.policyname = p.policyname);

alter policy "Anyone can view company name for NPS" on public.onboarding_companies to authenticated;
alter policy "onboarding_companies_anon_names" on public.onboarding_companies to authenticated;
alter policy "Anyone can view project info for NPS" on public.onboarding_projects to authenticated;
alter policy "Anyone can view task templates" on public.onboarding_task_templates to authenticated;

-- Financeiro e marketing: as regras de visitante saem (a equipe já tem a regra dela).
drop policy if exists "public_read_financial_by_token" on public.financial_consultation_forms;
drop policy if exists "public_update_financial_by_token" on public.financial_consultation_forms;
drop policy if exists "public_read_marketing_by_token" on public.marketing_consultation_forms;
drop policy if exists "public_update_marketing_by_token" on public.marketing_consultation_forms;

-- Tráfego: a mesma regra servia visitante e equipe; fica só com login.
alter policy "Public access via token" on public.traffic_analysis_forms to authenticated;
alter policy "Public can update via token" on public.traffic_analysis_forms to authenticated;

alter policy "Candidates can view their disc via token" on public.candidate_disc_results to authenticated;
alter policy "Public can update pending disc via token" on public.candidate_disc_results to authenticated;
