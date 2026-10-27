-- Time de IA: Dudu (tráfego) e Júlia (qualificação) passam a rodar em rodada
-- (leem crm_meta_ads_* e crm_leads). O seed dos times novos já sai com horário.
-- config.dados = 'nexus_unv' no orquestrador liga o contexto do próprio Nexus
-- (CRM tenant null, faturas, contas a pagar, carteira/churn, health, NPS, Meta, catálogo).
create or replace function public.ai_team_seed_defaults(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare n integer;
begin
  if not (client_has_company_access(p_company_id) or staff_has_company_access(p_company_id)) then
    raise exception 'sem acesso à empresa';
  end if;

  insert into public.ai_team_agents (company_id, agent_key, name, role_title, description, color, schedule, config) values
    (p_company_id, 'orquestrador', 'Max',   'Coordenador do time',      'Distribui o trabalho entre os especialistas, consolida o que cada um fez e te entrega um briefing único.', '#0D2B5E', null, '{"send_whatsapp": false}'),
    (p_company_id, 'atendimento',  'Lia',   'Atendimento 24h',          'Responde Direct e WhatsApp a qualquer hora pelo agente de IA do CRM, qualifica e agenda.', '#CC1B1B', null, '{}'),
    (p_company_id, 'briefing',     'Bia',   'Resumo diário',            'Todo dia às 8h lê os números de ontem, compara com a média e te diz onde apertar hoje.', '#1F6FEB', '{"hour":"08:00","days":[1,2,3,4,5,6]}', '{}'),
    (p_company_id, 'anuncios',     'Rafa',  'Criador de anúncios',      'Toda segunda deixa 3 anúncios prontos (copy, CTA e público) pra você aprovar com um clique.', '#B45309', '{"hour":"08:00","days":[1]}', '{"oferta": "", "publico": "", "tom": ""}'),
    (p_company_id, 'conteudo',     'Nina',  'Conteúdo e social',        'Toda terça propõe 3 posts com gancho, legenda e formato, alinhados com a oferta da semana.', '#7C3AED', '{"hour":"08:00","days":[2]}', '{}'),
    (p_company_id, 'reativacao',   'Theo',  'Reativação de clientes',   'Toda quarta monta mensagens de reativação pra clientes e leads parados.', '#0F766E', '{"hour":"09:00","days":[3]}', '{}'),
    (p_company_id, 'trafego',      'Dudu',  'Analista de tráfego',      'De segunda a sexta às 8h30 lê as campanhas da Meta e diz o que merece verba e o que está queimando dinheiro.', '#9333EA', '{"hour":"08:30","days":[1,2,3,4,5]}', '{}'),
    (p_company_id, 'qualificacao', 'Júlia', 'Qualificação de leads',    'Toda manhã às 8h15 olha os leads das últimas 24h e diz quem ligar primeiro e quem está sem dono.', '#DB2777', '{"hour":"08:15","days":[1,2,3,4,5,6]}', '{}')
  on conflict (company_id, agent_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $fn$;
