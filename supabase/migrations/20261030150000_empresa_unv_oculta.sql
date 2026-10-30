-- 30/10/2026, Fabrício: a empresa "UNV - Universidade Nacional de Vendas" (4d3e83ba) é só a casa do Time de IA da
-- própria UNV. "Nem eu nem ninguém precisa ver, não pode somar nada dela em número nenhum. Literalmente invisível a todos."
-- Não dá pra apagar nem inativar: os agentes/execuções/mensagens do Time de IA e as tarefas que o Max cria apontam pra ela,
-- e status inativo desativa as tarefas e chama o desligamento de cliente cancelado.

-- 1) Empresa oculta: some de toda tela (RLS restritiva vale pra master também; service_role e funções security definer
--    continuam lendo, então o Time de IA e o Max seguem funcionando). is_simulator tira de painéis e métricas.
alter table public.onboarding_companies add column if not exists oculta boolean not null default false;

drop policy if exists onboarding_companies_oculta on public.onboarding_companies;
create policy onboarding_companies_oculta on public.onboarding_companies
  as restrictive for select to public using (not oculta);

update public.onboarding_companies set oculta = true, is_simulator = true
 where id = '4d3e83ba-4521-4a3d-839f-21dd53dc8554';

-- 2) Projeto "Time de IA" fora de "active": radar/previsão de churn, saúde e contagens só olham projeto ativo.
--    'interno' não está na lista do trg_project_churned (closed/cancelled/completed), então não inativa a empresa.
update public.onboarding_projects set status = 'interno'
 where onboarding_company_id = '4d3e83ba-4521-4a3d-839f-21dd53dc8554' and status = 'active';

-- 3) Automações da empresa desligadas (NPS, CSAT, meta do dia, ranking, resumos...)
insert into public.company_automation_settings (company_id, automation_key, enabled, updated_at)
select '4d3e83ba-4521-4a3d-839f-21dd53dc8554', k, false, now()
  from unnest(array['fechamento_dia','csat','nps','resumo_diario','lembretes_reuniao','ranking_vendas','relatorio_pdf',
                    'meta_diaria_vendedores','cobranca_numeros','trafego_resumo']) as k
on conflict (company_id, automation_key) do update set enabled = false, updated_at = now();
