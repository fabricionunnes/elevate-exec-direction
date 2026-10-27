-- Time de IA: master e admin enxergam qualquer time. staff_has_company_access()
-- só cobre admin + quem está alocado na empresa/projeto, então o master (Fabrício)
-- abria a tela da UNV e via tudo vazio, e a function devolvia 403 ao rodar.
-- Uma função única de acesso pra RLS, seed e orquestrador usarem a mesma regra.
create or replace function public.ai_team_has_access(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select client_has_company_access(p_company_id)
      or staff_has_company_access(p_company_id)
      or exists (
        select 1 from onboarding_staff s
        where s.user_id = auth.uid() and s.is_active = true and s.role in ('master', 'admin')
      );
$fn$;
revoke execute on function public.ai_team_has_access(uuid) from public, anon;
grant execute on function public.ai_team_has_access(uuid) to authenticated, service_role;

drop policy if exists ai_team_agents_access on public.ai_team_agents;
create policy ai_team_agents_access on public.ai_team_agents for all
  using (ai_team_has_access(company_id)) with check (ai_team_has_access(company_id));

drop policy if exists ai_team_runs_read on public.ai_team_runs;
create policy ai_team_runs_read on public.ai_team_runs for select
  using (ai_team_has_access(company_id));

drop policy if exists ai_team_approvals_access on public.ai_team_approvals;
create policy ai_team_approvals_access on public.ai_team_approvals for all
  using (ai_team_has_access(company_id)) with check (ai_team_has_access(company_id));

-- seed: mesma regra
create or replace function public.ai_team_seed_defaults(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare n integer;
begin
  if not ai_team_has_access(p_company_id) then
    raise exception 'sem acesso à empresa';
  end if;

  insert into public.ai_team_agents (company_id, agent_key, name, role_title, description, color, schedule, config) values
    (p_company_id, 'orquestrador', 'Max',    'Coordenador do time',      'Distribui o trabalho entre os especialistas, consolida o que cada um fez e te entrega um briefing único.', '#0D2B5E', null, '{"send_whatsapp": false}'),
    (p_company_id, 'atendimento',  'Lia',    'Atendimento 24h',          'Responde Direct e WhatsApp a qualquer hora pelo agente de IA do CRM, qualifica e agenda.', '#CC1B1B', null, '{}'),
    (p_company_id, 'briefing',     'Sophia', 'Head comercial',           'Todo dia às 8h lê financeiro, comercial e carteira, compara com o mês anterior e te diz onde apertar hoje.', '#1F6FEB', '{"hour":"08:00","days":[1,2,3,4,5,6]}', '{}'),
    (p_company_id, 'anuncios',     'Rafa',   'Criador de anúncios',      'Toda segunda deixa 3 anúncios prontos (copy, CTA e público) apoiados nas campanhas que já trazem lead barato.', '#B45309', '{"hour":"08:00","days":[1]}', '{"oferta": "", "publico": "", "tom": ""}'),
    (p_company_id, 'conteudo',     'Mika',   'Conteúdo e social',        'Toda terça propõe 3 posts com gancho, legenda e formato, a partir do que o comercial está vivendo.', '#7C3AED', '{"hour":"08:00","days":[2]}', '{}'),
    (p_company_id, 'reativacao',   'Theo',   'Reativação de clientes',   'Toda quarta escreve mensagens com nome pra leads parados e clientes que saíram.', '#0F766E', '{"hour":"09:00","days":[3]}', '{}'),
    (p_company_id, 'trafego',      'Luna',   'Head de marketing',        'De segunda a sexta às 8h30 lê as campanhas da Meta e diz o que merece verba e o que está queimando dinheiro.', '#9333EA', '{"hour":"08:30","days":[1,2,3,4,5]}', '{}'),
    (p_company_id, 'qualificacao', 'Júlia',  'Qualificação de leads',    'Toda manhã às 8h15 olha os leads das últimas 24h e diz quem ligar primeiro e quem está sem dono.', '#DB2777', '{"hour":"08:15","days":[1,2,3,4,5,6]}', '{}')
  on conflict (company_id, agent_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $fn$;
