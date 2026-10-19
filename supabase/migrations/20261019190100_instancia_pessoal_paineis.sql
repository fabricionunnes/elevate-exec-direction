-- Instância pessoal fora de todo painel e vigia que lê mensagens (Fabrício, 19/10/2026:
-- "isso não pode aparecer em lugar nenhum"). Definições tiradas do banco em 19/10/2026 e
-- alteradas só nos trechos com wa_conversa_pessoal / is_personal.
CREATE OR REPLACE FUNCTION public.painel_ao_vivo_interno()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tz text := 'America/Sao_Paulo';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  d0 timestamptz := hoje::timestamp at time zone 'America/Sao_Paulo';
  d1 timestamptz := (hoje + 1)::timestamp at time zone 'America/Sao_Paulo';
  s0 timestamptz := (hoje - ((extract(isodow from hoje)::int) - 1))::timestamp at time zone 'America/Sao_Paulo';
  s1 timestamptz := s0 + interval '7 days';
  m_ini date := date_trunc('month', hoje)::date;
  m0 timestamptz := m_ini::timestamp at time zone 'America/Sao_Paulo';
  m1 timestamptz := (m_ini + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';
  meta jsonb; du_total int; du_passados int;
  r jsonb;
begin
  meta := painel_meta_mes_interno(m_ini);
  select count(*) filter (where painel_dia_util(g::date)), count(*) filter (where painel_dia_util(g::date) and g::date <= hoje)
    into du_total, du_passados from generate_series(m_ini, (m_ini + interval '1 month')::date - 1, interval '1 day') g;

  with
  per(k, a, b) as (values ('hoje', d0, d1), ('semana', s0, s1), ('mes', m0, m1)),
  won as (
    select l.closed_at ts, coalesce(l.opportunity_value, 0) v, coalesce(l.closer_staff_id, l.owner_staff_id) staff, coalesce(l.name, l.company) nome
      from crm_leads l join crm_stages st on st.id = l.stage_id
     where st.final_type = 'won' and l.tenant_id is null and l.closed_at >= m0 and l.closed_at < m1
       and coalesce((select p.name from crm_pipelines p where p.id = l.pipeline_id), '') !~* 'evento|mans[ãa]o|palestra'),
  leads as (select created_at ts, coalesce(name, company) nome from crm_leads where tenant_id is null and created_at >= m0 and created_at < m1),
  ev as (select event_date ts, event_type, credited_staff_id staff, lead_id from crm_meeting_events where event_date >= m0 and event_date < m1),
  msgs as (
    select m.created_at ts, m.direction, cv.id conv, ct.name contato, m.content
      from crm_whatsapp_messages m join crm_whatsapp_conversations cv on cv.id = m.conversation_id
      left join crm_whatsapp_contacts ct on ct.id = cv.contact_id
     where m.created_at >= d0 and m.created_at < d1 and coalesce(ct.phone,'') not like '120363%'
       and not wa_conversa_pessoal(cv.instance_id)),
  rec as (select paid_at ts, coalesce(paid_amount_cents, amount_cents) c, description, company_id from company_invoices where status = 'paid' and paid_at >= m0 and paid_at < m1),
  pag as (select (paid_date::timestamp at time zone 'America/Sao_Paulo') ts, coalesce(paid_amount, amount) v from financial_payables where status = 'paid' and paid_date >= m_ini and paid_date < (m_ini + interval '1 month')::date),
  periodos as (
    select p.k,
      (select count(*) from leads where ts >= p.a and ts < p.b) leads,
      (select count(*) from ev where event_type = 'scheduled' and ts >= p.a and ts < p.b) agendadas,
      (select count(*) from ev where event_type in ('realized','realized_out_of_icp') and ts >= p.a and ts < p.b) realizadas,
      (select count(*) from ev where event_type = 'no_show' and ts >= p.a and ts < p.b) no_show,
      (select count(*) from won where ts >= p.a and ts < p.b) vendas_n,
      (select coalesce(sum(v),0) from won where ts >= p.a and ts < p.b) vendas_v,
      (select coalesce(sum(c),0)/100.0 from rec where ts >= p.a and ts < p.b) recebido,
      (select coalesce(sum(v),0) from pag where ts >= p.a and ts < p.b) pago
    from per p)
  select jsonb_build_object(
    'gerado_em', now(),
    'periodos', (select jsonb_object_agg(k, to_jsonb(periodos) - 'k') from periodos),
    'meta_mes', (meta->>'meta')::numeric, 'du_total', du_total, 'du_passados', du_passados,
    'conversas', jsonb_build_object(
      'msgs_in_hoje', (select count(*) from msgs where direction = 'inbound'),
      'msgs_out_hoje', (select count(*) from msgs where direction = 'outbound'),
      'conversas_ativas_hoje', (select count(distinct conv) from msgs),
      'aguardando', (select count(*) from crm_whatsapp_conversations cv join crm_whatsapp_contacts ct on ct.id = cv.contact_id
                       where cv.last_message_direction = 'inbound' and coalesce(ct.phone,'') not like '120363%' and cv.status <> 'closed'),
      'aguardando_24h', (select count(*) from crm_whatsapp_conversations cv join crm_whatsapp_contacts ct on ct.id = cv.contact_id
                       where cv.last_message_direction = 'inbound' and cv.last_inbound_at < now() - interval '24 hours' and coalesce(ct.phone,'') not like '120363%' and cv.status <> 'closed')),
    'caixa', (select coalesce(sum(current_balance_cents),0)/100.0 from financial_banks where is_active),
    'inadimplencia', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(amount_cents),0)/100.0) from company_invoices where status in ('pending','overdue') and due_date < hoje),
    'em_call', (select coalesce(jsonb_agg(jsonb_build_object('lead', coalesce(l.name, l.company, c.to_number), 'agente', s.name, 'desde', coalesce(c.answered_at, c.started_at, c.created_at), 'status', c.status) order by c.created_at desc), '[]'::jsonb)
                  from crm_calls c left join crm_leads l on l.id = c.lead_id left join onboarding_staff s on s.id = c.agent_staff_id
                 where c.ended_at is null and c.created_at >= now() - interval '3 hours' and c.status not in ('completed','failed','busy','no-answer','canceled','cancelled')),
    'agenda_hoje', (select coalesce(jsonb_agg(jsonb_build_object('hora', l.scheduled_at, 'lead', coalesce(l.name, l.company), 'closer', s.name, 'etapa', st.name) order by l.scheduled_at), '[]'::jsonb)
                      from crm_leads l left join onboarding_staff s on s.id = coalesce(l.closer_staff_id, l.owner_staff_id) left join crm_stages st on st.id = l.stage_id
                     where l.tenant_id is null and l.scheduled_at >= d0 and l.scheduled_at < d1),
    'ranking_closers', (select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc, x->>'nome'), '[]'::jsonb) from (
        select jsonb_build_object('staff_id', q.id, 'nome', coalesce(s.name, 'Sem fechador'), 'vendas', coalesce(g.n,0), 'receita', coalesce(g.v,0),
                 'meta', (select (c->>'meta')::numeric from jsonb_array_elements(meta->'com_meta') c where (c->>'staff_id')::uuid = q.id),
                 'realizadas', (select count(*) from ev e where e.event_type in ('realized','realized_out_of_icp') and e.staff = q.id),
                 'no_show', (select count(*) from ev e where e.event_type = 'no_show' and e.staff = q.id),
                 'vendas_hoje', (select count(*) from won w2 where w2.staff = q.id and w2.ts >= d0),
                 'pipeline_n', (select count(*) from crm_leads l join crm_stages st on st.id = l.stage_id where l.tenant_id is null and st.final_type is null and coalesce(l.closer_staff_id, l.owner_staff_id) = q.id),
                 'pipeline_v', (select coalesce(sum(l.opportunity_value),0) from crm_leads l join crm_stages st on st.id = l.stage_id where l.tenant_id is null and st.final_type is null and coalesce(l.closer_staff_id, l.owner_staff_id) = q.id)) x
          from (select distinct coalesce(w.staff, (c->>'staff_id')::uuid) id from won w full join jsonb_array_elements(meta->'com_meta') c on (c->>'staff_id')::uuid = w.staff) q
          left join (select staff, count(*) n, sum(v) v from won group by staff) g on g.staff = q.id
          left join onboarding_staff s on s.id = q.id) y),
    'ranking_sdr', (select coalesce(jsonb_agg(x order by (x->>'agendadas')::int desc, x->>'nome'), '[]'::jsonb) from (
        select jsonb_build_object('staff_id', e.staff, 'nome', coalesce(s.name, 'Sem crédito'),
                 'agendadas', count(*) filter (where e.event_type = 'scheduled'),
                 'agendadas_hoje', count(*) filter (where e.event_type = 'scheduled' and e.ts >= d0),
                 'agendadas_semana', count(*) filter (where e.event_type = 'scheduled' and e.ts >= s0),
                 'realizadas', count(*) filter (where e.event_type in ('realized','realized_out_of_icp')),
                 'no_show', count(*) filter (where e.event_type = 'no_show'),
                 'leads_mes', (select count(*) from crm_leads l where l.tenant_id is null and l.created_at >= m0 and l.sdr_staff_id = e.staff)) x
          from ev e left join onboarding_staff s on s.id = e.staff group by e.staff, s.name) y),
    -- agentes de IA: respostas e reuniões agendadas pela IA (tool agendar_reuniao com retorno "Reunião agendada")
    'ranking_agentes', (select coalesce(jsonb_agg(x order by (x->>'agendadas_mes')::int desc, (x->>'respostas_mes')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('agent_id', a.id, 'nome', a.name, 'ativo', a.is_active,
                 'respostas_hoje', count(*) filter (where r.created_at >= d0 and r.outcome like 'sent%'),
                 'respostas_mes', count(*) filter (where r.outcome like 'sent%'),
                 'conversas_mes', count(distinct r.conversation_id) filter (where r.outcome like 'sent%'),
                 'agendadas_hoje', count(*) filter (where r.created_at >= d0 and r.tool_calls::text ~* 'agendar_reuniao\([^]]*\) -> Reuni[ãa]o agendada'),
                 'agendadas_semana', count(*) filter (where r.created_at >= s0 and r.tool_calls::text ~* 'agendar_reuniao\([^]]*\) -> Reuni[ãa]o agendada'),
                 'agendadas_mes', count(*) filter (where r.tool_calls::text ~* 'agendar_reuniao\([^]]*\) -> Reuni[ãa]o agendada')) x
          from crm_ai_agent_runs r join crm_ai_agents a on a.id = r.agent_id
         where r.created_at >= m0 and r.created_at < m1 and a.tenant_id is null
         group by a.id, a.name, a.is_active
        having count(*) filter (where r.outcome like 'sent%') > 0) y),
    -- meta do dia: comercial (quanto falta vender por dia útil), financeiro (vencimentos de hoje) e produto (entrega do dia)
    'meta_dia', jsonb_build_object(
      'comercial', jsonb_build_object(
        'meta_mes', (meta->>'meta')::numeric,
        'vendido_mes', (select coalesce(sum(v),0) from won),
        'vendido_hoje', (select coalesce(sum(v),0) from won where ts >= d0),
        'vendas_hoje', (select count(*) from won where ts >= d0),
        'du_restantes', greatest(du_total - du_passados + case when painel_dia_util(hoje) then 1 else 0 end, 1),
        'meta_dia', case when (meta->>'meta') is not null then round(greatest((meta->>'meta')::numeric - (select coalesce(sum(v),0) from won where ts < d0), 0) / greatest(du_total - du_passados + case when painel_dia_util(hoje) then 1 else 0 end, 1), 2) end),
      'financeiro', jsonb_build_object(
        'vencendo_hoje_n', (select count(*) from company_invoices where due_date = hoje and status in ('pending','overdue','paid','partial')),
        'vencendo_hoje_v', (select coalesce(sum(amount_cents),0)/100.0 from company_invoices where due_date = hoje and status in ('pending','overdue','paid','partial')),
        'vencendo_hoje_pago_v', (select coalesce(sum(coalesce(paid_amount_cents, amount_cents)),0)/100.0 from company_invoices where due_date = hoje and status in ('paid','partial')),
        'a_receber_hoje_n', (select count(*) from company_invoices where due_date = hoje and status in ('pending','overdue')),
        'a_receber_hoje_v', (select coalesce(sum(amount_cents),0)/100.0 from company_invoices where due_date = hoje and status in ('pending','overdue')),
        'recebido_hoje', (select coalesce(sum(c),0)/100.0 from rec where ts >= d0),
        'recebido_hoje_n', (select count(*) from rec where ts >= d0),
        'a_pagar_hoje_v', (select coalesce(sum(amount),0) from financial_payables where due_date = hoje and status <> 'cancelled'),
        'pago_hoje', (select coalesce(sum(v),0) from pag where ts >= d0)),
      'produto', jsonb_build_object(
        'tarefas_vencem_hoje', (select count(*) from onboarding_tasks t where t.due_date = hoje and t.status::text <> 'inactive'),
        'tarefas_vencem_hoje_feitas', (select count(*) from onboarding_tasks t where t.due_date = hoje and t.status::text = 'completed'),
        'tarefas_atrasadas', (select count(*) from onboarding_tasks t where t.due_date < hoje and t.status::text in ('pending','in_progress')),
        'tarefas_feitas_hoje', (select count(*) from onboarding_tasks t where t.completed_at >= d0 and t.completed_at < d1),
        'reunioes_cs_hoje', (select count(*) from onboarding_meeting_notes mn where mn.meeting_date >= d0 and mn.meeting_date < d1 and not coalesce(mn.is_internal,false)),
        'reunioes_cs_feitas', (select count(*) from onboarding_meeting_notes mn where mn.meeting_date >= d0 and mn.meeting_date < now() and not coalesce(mn.is_internal,false) and not coalesce(mn.is_no_show,false)),
        'checkup_pendentes', (select count(*) from produto_checkup_itens i where i.dia = hoje and i.tratado_em is null),
        'checkup_total', (select count(*) from produto_checkup_itens i where i.dia = hoje))),
    -- gráficos: vendas por dia do mês, funil do mês e tendência (6 meses + projeção)
    'serie_dias', (select coalesce(jsonb_agg(jsonb_build_object('dia', g::date, 'vendas', coalesce(w.n,0), 'receita', coalesce(w.v,0), 'leads', coalesce(l.n,0)) order by g), '[]'::jsonb)
                     from generate_series(m_ini, hoje, interval '1 day') g
                     left join (select (ts at time zone 'America/Sao_Paulo')::date dd, count(*) n, sum(v) v from won group by 1) w on w.dd = g::date
                     left join (select (ts at time zone 'America/Sao_Paulo')::date dd, count(*) n from leads group by 1) l on l.dd = g::date),
    'funil_mes', jsonb_build_object(
      'leads', (select count(*) from leads),
      'contatados', (select count(distinct cv.lead_id) from crm_whatsapp_messages mm join crm_whatsapp_conversations cv on cv.id = mm.conversation_id
                       where mm.direction = 'outbound' and mm.created_at >= m0 and mm.created_at < m1 and not wa_conversa_pessoal(cv.instance_id) and cv.lead_id in (select l.id from crm_leads l where l.tenant_id is null and l.created_at >= m0)),
      'agendadas', (select count(*) from ev where event_type = 'scheduled'),
      'realizadas', (select count(*) from ev where event_type in ('realized','realized_out_of_icp')),
      'vendas', (select count(*) from won)),
    'tendencia', jsonb_build_object(
      'meses', (select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(g, 'YYYY-MM'), 'receita', coalesce(w.v,0), 'vendas', coalesce(w.n,0), 'meta', (painel_meta_mes_interno(g::date)->>'meta')::numeric) order by g), '[]'::jsonb)
                   from generate_series(m_ini - interval '5 months', m_ini, interval '1 month') g
                   left join (select date_trunc('month', l.closed_at at time zone 'America/Sao_Paulo')::date mm, count(*) n, sum(coalesce(l.opportunity_value,0)) v
                                from crm_leads l join crm_stages st on st.id = l.stage_id
                               where st.final_type = 'won' and l.tenant_id is null and l.closed_at >= (m_ini - interval '5 months')::timestamp at time zone 'America/Sao_Paulo' and l.closed_at < m1
                                 and coalesce((select p.name from crm_pipelines p where p.id = l.pipeline_id), '') !~* 'evento|mans[ãa]o|palestra'
                               group by 1) w on w.mm = g::date),
      'projecao_mes', case when du_passados > 0 then round((select coalesce(sum(v),0) from won) / du_passados * du_total, 2) else null end,
      'leads_30d', (select count(*) from crm_leads where tenant_id is null and created_at >= now() - interval '30 days'),
      'leads_30d_ant', (select count(*) from crm_leads where tenant_id is null and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
      'reunioes_30d', (select count(*) from crm_meeting_events where event_type = 'scheduled' and event_date >= now() - interval '30 days'),
      'reunioes_30d_ant', (select count(*) from crm_meeting_events where event_type = 'scheduled' and event_date >= now() - interval '60 days' and event_date < now() - interval '30 days')),
    -- produto (o Nexus): saúde do dia e IA
    'produto', jsonb_build_object(
      'checkup_pendentes', (select count(*) from produto_checkup_itens i where i.dia = hoje and i.tratado_em is null),
      'agentes_ativos', (select count(*) from crm_ai_agents a where a.is_active and a.tenant_id is null),
      'respostas_ia_hoje', (select count(*) from crm_ai_agent_runs r where r.created_at >= d0 and r.created_at < d1 and r.outcome like 'sent%'),
      'respostas_ia_mes', (select count(*) from crm_ai_agent_runs r where r.created_at >= m0 and r.created_at < m1 and r.outcome like 'sent%'),
      'custo_ia_hoje_usd', (select coalesce(sum(custo_usd_estimado),0) from ai_usage_daily where dia = hoje),
      'custo_ia_mes_usd', (select coalesce(sum(custo_usd_estimado),0) from ai_usage_daily where dia >= m_ini and dia < (m_ini + interval '1 month')::date),
      'teto_dia_usd', (select teto_usd from ai_usage_config limit 1),
      'ia_ok', (select ok from ai_health_log order by checked_at desc limit 1)),
    'feed_contagem', jsonb_build_object(
      'tarefas_concluidas', (select count(*) from onboarding_tasks t where t.completed_at >= d0 and t.completed_at < d1),
      'atividades_concluidas', (select count(*) from crm_activities a where a.completed_at >= d0 and a.completed_at < d1),
      'reunioes_consultoria', (select count(*) from onboarding_meeting_notes mn where mn.meeting_date >= d0 and mn.meeting_date < d1 and not coalesce(mn.is_internal, false)),
      'mudancas_etapa', (select count(*) from crm_lead_history h where h.action = 'stage_change' and h.created_at >= d0 and h.created_at < d1)),
    'feed', (select coalesce(jsonb_agg(f order by (f->>'ts') desc), '[]'::jsonb) from (
               -- comercial
               (select jsonb_build_object('ts', ts, 'tipo', 'lead', 'texto', 'Lead novo: ' || coalesce(nome,'sem nome')) f from leads where ts >= d0 order by ts desc limit 40)
               union all (select jsonb_build_object('ts', ts, 'tipo', 'msg', 'texto', coalesce(contato,'Contato') || ': ' || left(regexp_replace(coalesce(content,''), '\s+', ' ', 'g'), 70)) from msgs where direction = 'inbound' order by ts desc limit 40)
               union all (select jsonb_build_object('ts', e.ts, 'tipo', e.event_type, 'texto', case e.event_type when 'scheduled' then 'Reunião agendada' when 'no_show' then 'No-show' when 'realized' then 'Reunião realizada' when 'realized_out_of_icp' then 'Reunião realizada (fora do ICP)' when 'out_of_icp' then 'Fora do ICP' else e.event_type end || ': ' || coalesce(l.name, l.company, '') || coalesce(' · ' || s.name, '')) from ev e left join crm_leads l on l.id = e.lead_id left join onboarding_staff s on s.id = e.staff where e.ts >= d0 order by e.ts desc limit 40)
               union all (select jsonb_build_object('ts', ts, 'tipo', 'venda', 'texto', 'Venda: ' || coalesce(nome,'') || ' · R$ ' || to_char(v, 'FM999G999G990D00')) from won where ts >= d0 order by ts desc limit 40)
               union all (select jsonb_build_object('ts', h.created_at, 'tipo', 'etapa', 'texto', coalesce(l.name, l.company, 'Lead') || ': ' || coalesce(h.old_value,'?') || ' → ' || coalesce(h.new_value,'?') || coalesce(' · ' || s.name, ''))
                            from crm_lead_history h left join crm_leads l on l.id = h.lead_id left join onboarding_staff s on s.id = h.staff_id
                           where h.action = 'stage_change' and h.created_at >= d0 and h.created_at < d1 and l.tenant_id is null order by h.created_at desc limit 40)
               union all (select jsonb_build_object('ts', a.completed_at, 'tipo', 'atividade', 'texto', 'Atividade concluída: ' || coalesce(a.title, a.type) || coalesce(' · ' || coalesce(l.name, l.company), '') || coalesce(' · ' || s.name, ''))
                            from crm_activities a left join crm_leads l on l.id = a.lead_id left join onboarding_staff s on s.id = a.responsible_staff_id
                           where a.completed_at >= d0 and a.completed_at < d1 order by a.completed_at desc limit 40)
               -- consultoria (entrega)
               union all (select jsonb_build_object('ts', t.completed_at, 'tipo', 'tarefa', 'texto', 'Tarefa concluída: ' || t.title || coalesce(' · ' || c.name, '') || coalesce(' · ' || s.name, ''))
                            from onboarding_tasks t left join onboarding_projects p on p.id = t.project_id left join onboarding_companies c on c.id = coalesce(p.onboarding_company_id, p.company_id) left join onboarding_staff s on s.id = t.responsible_staff_id
                           where t.completed_at >= d0 and t.completed_at < d1 order by t.completed_at desc limit 60)
               union all (select jsonb_build_object('ts', mn.meeting_date, 'tipo', case when mn.is_no_show then 'no_show' when mn.meeting_date <= now() then 'reuniao_cs' else 'reuniao_cs_prox' end,
                                                    'texto', case when mn.is_no_show then 'No-show (consultoria): ' when mn.meeting_date <= now() then 'Reunião com cliente: ' else 'Reunião marcada: ' end || coalesce(c.name, mn.meeting_title, '') || coalesce(' · ' || s.name, ''))
                            from onboarding_meeting_notes mn left join onboarding_projects p on p.id = mn.project_id left join onboarding_companies c on c.id = coalesce(p.onboarding_company_id, p.company_id) left join onboarding_staff s on s.id = mn.staff_id
                           where mn.meeting_date >= d0 and mn.meeting_date < d1 and not coalesce(mn.is_internal, false) order by mn.meeting_date desc limit 40)
               -- financeiro
               union all (select jsonb_build_object('ts', r.ts, 'tipo', 'recebido', 'texto', 'Recebido: ' || coalesce(c.name,'') || ' · R$ ' || to_char(r.c/100.0, 'FM999G999G990D00')) from rec r left join onboarding_companies c on c.id = r.company_id where r.ts >= d0 order by r.ts desc limit 40)
             ) z(f) ))
  into r;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.painel_controle_interno(p_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date;
  v_fim date;
  v_tz text := 'America/Sao_Paulo';
  t_ini timestamptz;
  t_fim timestamptz;
  s_ini date;          -- início da série (12 meses terminando no mês atual)
  s_fim date;
  ts_ini timestamptz;
  ts_fim timestamptz;
  fin jsonb; com jsonb; tra jsonb; cli jsonb; ate jsonb; ia jsonb; roda jsonb; equipe jsonb; serie jsonb;
  frente jsonb;  -- blocos "pra frente" (caixa projetado etc.), montados em painel_frente_interno
  alertas jsonb := '[]'::jsonb;
  lt record;
  n_vencidas int; v_vencidas numeric; n_venc7 int; v_venc7 numeric;
  n_pagar3 int; v_pagar3 numeric; v_pagar7 numeric; v_saldo numeric;
  n_ganhos_sem_valor int; n_conv24 int; n_conv_wait int;
  custo_ia numeric; teto_ia numeric; custo_hoje numeric; n_health_baixo int; n_vencendo int;
  n_checkup int; n_aviso int; n_nps_baixo int;
  -- conexão do Meta Ads (conta do CRM da UNV)
  m_tem_conta boolean := false; m_id uuid; m_nome text; m_act text; m_sync timestamptz;
  m_horas numeric; m_ult_gasto date; m_dias_sem int; m_gasto_antes numeric;
  -- saldo da conta de anúncios (gravado de hora em hora pela edge crm-meta-ads-balance)
  m_situacao text; m_pre boolean; m_saldo numeric; m_devido numeric; m_forma text; m_media numeric;
  m_saldo_em timestamptz; m_saldo_erro text; m_nivel text; m_dias_saldo numeric;
begin

  v_ini := date_trunc('month', coalesce(p_month, hoje))::date;
  v_fim := (v_ini + interval '1 month')::date;
  t_ini := v_ini::timestamp at time zone v_tz;
  t_fim := v_fim::timestamp at time zone v_tz;
  s_fim := (date_trunc('month', hoje) + interval '1 month')::date;
  s_ini := (s_fim - interval '12 months')::date;
  ts_ini := s_ini::timestamp at time zone v_tz;
  ts_fim := s_fim::timestamp at time zone v_tz;

  ---------------------------------------------------------------- financeiro
  select count(*), coalesce(sum(coalesce(i.total_with_fees_cents, i.amount_cents))/100.0, 0)
    into n_vencidas, v_vencidas
    from company_invoices i
   where i.paid_at is null and i.status in ('pending','overdue') and i.due_date < hoje;

  select count(*), coalesce(sum(coalesce(i.total_with_fees_cents, i.amount_cents))/100.0, 0)
    into n_venc7, v_venc7
    from company_invoices i
   where i.paid_at is null and i.status in ('pending','overdue') and i.due_date < hoje - 7;

  select count(*), coalesce(sum(p.amount - coalesce(p.paid_amount,0)), 0)
    into n_pagar3, v_pagar3
    from financial_payables p
   where p.status in ('pending','partial') and p.tenant_id is null and p.due_date between hoje and hoje + 3;

  select coalesce(sum(p.amount - coalesce(p.paid_amount,0)), 0) into v_pagar7
    from financial_payables p
   where p.status in ('pending','partial') and p.tenant_id is null and p.due_date between hoje and hoje + 7;

  select coalesce(sum(b.current_balance_cents)/100.0, 0) into v_saldo
    from financial_banks b where b.is_active and b.tenant_id is null;

  with mc as materialized (select * from painel_mrr_cobrancas())
  select jsonb_build_object(
    'recebido', (select coalesce(sum(coalesce(i.paid_amount_cents, i.amount_cents))/100.0,0) from company_invoices i
                  where i.status = 'paid' and i.paid_at >= t_ini and i.paid_at < t_fim),
    'recebido_n', (select count(*) from company_invoices i where i.status = 'paid' and i.paid_at >= t_ini and i.paid_at < t_fim),
    'a_receber', (select coalesce(sum(i.amount_cents)/100.0,0) from company_invoices i
                   where i.paid_at is null and i.status in ('pending','overdue') and i.due_date >= v_ini and i.due_date < v_fim),
    'a_receber_n', (select count(*) from company_invoices i
                   where i.paid_at is null and i.status in ('pending','overdue') and i.due_date >= v_ini and i.due_date < v_fim),
    'vencidas', v_vencidas, 'vencidas_n', n_vencidas,
    'vencidas_7d', v_venc7, 'vencidas_7d_n', n_venc7,
    'pago', (select coalesce(sum(coalesce(p.paid_amount, p.amount)),0) from financial_payables p
              where p.status = 'paid' and p.tenant_id is null and p.paid_date >= v_ini and p.paid_date < v_fim),
    'pago_n', (select count(*) from financial_payables p
              where p.status = 'paid' and p.tenant_id is null and p.paid_date >= v_ini and p.paid_date < v_fim),
    'a_pagar', (select coalesce(sum(p.amount - coalesce(p.paid_amount,0)),0) from financial_payables p
                 where p.status in ('pending','partial') and p.tenant_id is null and p.due_date >= v_ini and p.due_date < v_fim),
    'a_pagar_n', (select count(*) from financial_payables p
                 where p.status in ('pending','partial') and p.tenant_id is null and p.due_date >= v_ini and p.due_date < v_fim),
    'a_pagar_3d', v_pagar3, 'a_pagar_3d_n', n_pagar3, 'a_pagar_7d', v_pagar7,
    'saldo_bancos', v_saldo,
    'bancos', (select coalesce(jsonb_agg(jsonb_build_object('nome', b.name, 'saldo', b.current_balance_cents/100.0,
                 'saldo_provedor', case when b.provider_balance_at is not null then b.provider_balance_cents/100.0 end,
                 'atualizado_em', b.provider_balance_at) order by b.current_balance_cents desc), '[]')
               from financial_banks b where b.is_active and b.tenant_id is null),
    -- MRR oficial: só o que fatura todo mês (painel_mrr_cobrancas, no_mrr)
    'mrr', (select coalesce(sum(m.valor), 0) from mc m where m.no_mrr),
    'mrr_n', (select count(*) from mc m where m.no_mrr),
    'mrr_clientes', (select count(distinct m.company_id) from mc m where m.no_mrr),
    'mrr_em_aviso', (select coalesce(sum(m.valor), 0) from mc m where m.no_mrr and m.em_aviso),
    'mrr_fora_n', (select count(*) from mc m where not m.no_mrr),
    'mrr_fora_valor', (select coalesce(sum(m.valor), 0) from mc m where not m.no_mrr),
    'vencidas_lista', (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc), '[]') from (
        select jsonb_build_object('empresa', c.name, 'company_id', c.id, 'valor', coalesce(i.total_with_fees_cents, i.amount_cents)/100.0,
                 'vencimento', i.due_date, 'dias', hoje - i.due_date, 'descricao', i.description) x
          from company_invoices i join onboarding_companies c on c.id = i.company_id
         where i.paid_at is null and i.status in ('pending','overdue') and i.due_date < hoje
         order by coalesce(i.total_with_fees_cents, i.amount_cents) desc limit 40) y),
    'a_pagar_lista', (select coalesce(jsonb_agg(x order by x->>'vencimento'), '[]') from (
        select jsonb_build_object('fornecedor', p.supplier_name, 'descricao', p.description, 'valor', p.amount - coalesce(p.paid_amount,0),
                 'vencimento', p.due_date, 'status', p.status) x
          from financial_payables p
         where p.status in ('pending','partial') and p.tenant_id is null and p.due_date >= least(v_ini, hoje) and p.due_date < greatest(v_fim, hoje + 8)
         order by p.due_date limit 60) y),
    'recebido_por_empresa', (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc), '[]') from (
        select jsonb_build_object('empresa', c.name, 'company_id', c.id, 'valor', sum(coalesce(i.paid_amount_cents, i.amount_cents))/100.0, 'n', count(*)) x
          from company_invoices i join onboarding_companies c on c.id = i.company_id
         where i.status = 'paid' and i.paid_at >= t_ini and i.paid_at < t_fim
         group by c.id, c.name order by 1 desc limit 25) y),
    'pago_por_categoria', (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc), '[]') from (
        select jsonb_build_object('categoria', coalesce(fc.name, 'Sem categoria'), 'valor', sum(coalesce(p.paid_amount, p.amount)), 'n', count(*)) x
          from financial_payables p left join staff_financial_categories fc on fc.id = p.category_id
         where p.status = 'paid' and p.tenant_id is null and p.paid_date >= v_ini and p.paid_date < v_fim
         group by fc.name order by 1 desc limit 20) y)
  ) into fin;

  fin := fin || jsonb_build_object('lucro', (fin->>'recebido')::numeric - (fin->>'pago')::numeric);

  ---------------------------------------------------------------- comercial
  select count(*) into n_ganhos_sem_valor
    from crm_leads l join crm_stages st on st.id = l.stage_id
   where st.final_type = 'won' and l.closed_at >= t_ini and l.closed_at < t_fim and l.tenant_id is null
     and coalesce(l.opportunity_value,0) <= 0;

  with ganhos as (
    select l.id, l.name, l.company, l.opportunity_value val, l.closed_at, l.pipeline_id,
           coalesce(l.closer_staff_id, l.owner_staff_id) closer_id, l.sdr_staff_id, l.origin, l.utm_source, l.meta_campaign_id
      from crm_leads l join crm_stages st on st.id = l.stage_id
     where st.final_type = 'won' and l.closed_at >= t_ini and l.closed_at < t_fim and l.tenant_id is null
  ),
  ev as (
    select e.event_type, e.credited_staff_id, e.owner_staff_id, e.pipeline_id, e.lead_id, e.event_date
      from crm_meeting_events e where e.event_date >= t_ini and e.event_date < t_fim
  ),
  novos as (
    select l.pipeline_id, count(*) n from crm_leads l
     where l.created_at >= t_ini and l.created_at < t_fim and l.tenant_id is null group by 1
  )
  select jsonb_build_object(
    'leads', (select coalesce(sum(n),0) from novos),
    'leads_inflow', (select coalesce(sum(n.n),0) from novos n join crm_pipelines p on p.id = n.pipeline_id where p.counts_lead_inflow),
    -- MQL: lead do mês (funis que contam) que respondeu, avançou da etapa de entrada ou tem reunião.
    -- SQL: lead do mês (funis que contam) com reunião agendada/realizada. Mesma regra da Visão geral do CRM (16/10/2026).
    'mql', (select count(*) from crm_leads l join crm_pipelines p on p.id = l.pipeline_id
             where l.created_at >= t_ini and l.created_at < t_fim and l.tenant_id is null and p.counts_lead_inflow
               and (exists (select 1 from crm_whatsapp_conversations cv join crm_whatsapp_messages mm on mm.conversation_id = cv.id where cv.lead_id = l.id and mm.direction = 'inbound')
                 or exists (select 1 from instagram_conversations cv join instagram_messages mm on mm.conversation_id = cv.id where cv.lead_id = l.id and mm.direction = 'inbound')
                 or exists (select 1 from crm_stages s join crm_stages s0 on s0.pipeline_id = s.pipeline_id where s.id = l.stage_id group by s.sort_order having s.sort_order > min(s0.sort_order))
                 or exists (select 1 from crm_meeting_events e where e.lead_id = l.id)
                 or exists (select 1 from crm_activities a where a.lead_id = l.id and a.type = 'meeting'))),
    'sql', (select count(*) from crm_leads l join crm_pipelines p on p.id = l.pipeline_id
             where l.created_at >= t_ini and l.created_at < t_fim and l.tenant_id is null and p.counts_lead_inflow
               and (exists (select 1 from crm_meeting_events e where e.lead_id = l.id and e.event_type in ('scheduled','realized'))
                 or exists (select 1 from crm_activities a where a.lead_id = l.id and a.type = 'meeting'))),
    'agendadas', (select count(*) from ev where event_type = 'scheduled'),
    'realizadas', (select count(*) from ev where event_type in ('realized','realized_out_of_icp')),
    'no_show', (select count(*) from ev where event_type = 'no_show'),
    'fora_icp', (select count(*) from ev where event_type in ('out_of_icp','realized_out_of_icp')),
    'vendas', (select count(*) from ganhos),
    'receita', (select coalesce(sum(val),0) from ganhos),
    'ganhos_sem_valor', n_ganhos_sem_valor,
    'por_closer', (select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc, (x->>'vendas')::int desc), '[]') from (
        select jsonb_build_object('id', s.id, 'nome', s.name, 'papel', s.role,
                 'realizadas', (select count(*) from ev where ev.owner_staff_id = s.id and ev.event_type in ('realized','realized_out_of_icp')),
                 'no_show', (select count(*) from ev where ev.owner_staff_id = s.id and ev.event_type = 'no_show'),
                 'vendas', (select count(*) from ganhos g where g.closer_id = s.id),
                 'receita', (select coalesce(sum(val),0) from ganhos g where g.closer_id = s.id)) x
          from onboarding_staff s
         where s.tenant_id is null and (s.id in (select owner_staff_id from ev) or s.id in (select closer_id from ganhos))) y),
    'por_sdr', (select coalesce(jsonb_agg(x order by (x->>'agendadas')::int desc), '[]') from (
        select jsonb_build_object('id', s.id, 'nome', s.name, 'papel', s.role,
                 'agendadas', (select count(*) from ev where ev.credited_staff_id = s.id and ev.event_type = 'scheduled'),
                 'realizadas', (select count(*) from ev where ev.credited_staff_id = s.id and ev.event_type in ('realized','realized_out_of_icp')),
                 'no_show', (select count(*) from ev where ev.credited_staff_id = s.id and ev.event_type = 'no_show'),
                 'fora_icp', (select count(*) from ev where ev.credited_staff_id = s.id and ev.event_type in ('out_of_icp','realized_out_of_icp')),
                 'vendas', (select count(*) from ganhos g where g.sdr_staff_id = s.id)) x
          from onboarding_staff s
         where s.tenant_id is null and (s.id in (select credited_staff_id from ev) or s.id in (select sdr_staff_id from ganhos))) y),
    'por_funil', (select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc, (x->>'leads')::int desc), '[]') from (
        select jsonb_build_object('id', p.id, 'nome', p.name, 'conta_entrada', p.counts_lead_inflow,
                 'leads', coalesce((select n from novos where novos.pipeline_id = p.id),0),
                 'agendadas', (select count(*) from ev where ev.pipeline_id = p.id and ev.event_type = 'scheduled'),
                 'realizadas', (select count(*) from ev where ev.pipeline_id = p.id and ev.event_type in ('realized','realized_out_of_icp')),
                 'no_show', (select count(*) from ev where ev.pipeline_id = p.id and ev.event_type = 'no_show'),
                 'vendas', (select count(*) from ganhos g where g.pipeline_id = p.id),
                 'receita', (select coalesce(sum(val),0) from ganhos g where g.pipeline_id = p.id)) x
          from crm_pipelines p
         where p.tenant_id is null and p.is_active
           and (p.id in (select pipeline_id from novos) or p.id in (select pipeline_id from ev) or p.id in (select pipeline_id from ganhos))) y),
    'vendas_lista', (select coalesce(jsonb_agg(x order by x->>'data' desc), '[]') from (
        select jsonb_build_object('lead_id', g.id, 'nome', g.name, 'empresa', g.company, 'valor', g.val,
                 'data', (g.closed_at at time zone v_tz)::date, 'closer', cs.name, 'sdr', sd.name, 'funil', p.name,
                 'origem', coalesce(g.origin, g.utm_source, case when g.meta_campaign_id is not null then 'Meta Ads' end),
                 'pago', (g.meta_campaign_id is not null or lower(coalesce(g.utm_source,'')) in ('facebook','fb','ig','instagram','meta'))) x
          from ganhos g left join onboarding_staff cs on cs.id = g.closer_id left join onboarding_staff sd on sd.id = g.sdr_staff_id
          left join crm_pipelines p on p.id = g.pipeline_id) y),
    'reunioes_lista', (select coalesce(jsonb_agg(x order by x->>'data' desc), '[]') from (
        select jsonb_build_object('lead_id', e.lead_id, 'nome', l.name, 'empresa', l.company, 'tipo', e.event_type,
                 'data', e.event_date, 'sdr', sd.name, 'closer', ow.name, 'funil', p.name) x
          from ev e left join crm_leads l on l.id = e.lead_id left join onboarding_staff sd on sd.id = e.credited_staff_id
          left join onboarding_staff ow on ow.id = e.owner_staff_id left join crm_pipelines p on p.id = e.pipeline_id
          order by e.event_date desc limit 400) y)
  ) into com;

  com := com || jsonb_build_object(
    'ticket', case when (com->>'vendas')::int > 0 then (com->>'receita')::numeric / (com->>'vendas')::int end,
    'conv_reuniao_venda', case when (com->>'realizadas')::int > 0 then (com->>'vendas')::numeric / (com->>'realizadas')::int end,
    'presenca', case when ((com->>'realizadas')::int + (com->>'no_show')::int) > 0
                     then (com->>'realizadas')::numeric / ((com->>'realizadas')::int + (com->>'no_show')::int) end);

  ---------------------------------------------------------------- tráfego pago
  -- Estado da conexão: a conta conectada mais recente do CRM da UNV. Os crons 138
  -- (2 em 2 h) e 139 (diário) chamam a edge crm-meta-ads-sync; se last_synced_at
  -- ficar velho é porque o acesso venceu ou a conexão caiu.
  select a.id, a.ad_account_name, a.ad_account_id, a.last_synced_at,
         a.meta_account_status_label, a.is_prepaid, a.available_balance, a.amount_owed, a.funding_source,
         a.daily_spend_avg, a.balance_checked_at, a.balance_error, a.balance_alert_level
    into m_id, m_nome, m_act, m_sync,
         m_situacao, m_pre, m_saldo, m_devido, m_forma, m_media, m_saldo_em, m_saldo_erro, m_nivel
    from crm_meta_ads_accounts a
   where a.tenant_id is null and a.is_connected
   order by a.last_synced_at desc nulls last limit 1;
  m_tem_conta := found;
  if m_sync is not null then m_horas := round(extract(epoch from (now() - m_sync)) / 3600.0, 1); end if;
  -- saldo nunca conferido fica nulo (a tela mostra "-"), não zero
  if m_saldo_em is null then m_saldo := null; m_nivel := null; end if;
  if m_saldo is not null and coalesce(m_media,0) > 0 then m_dias_saldo := round(m_saldo / m_media, 1); end if;
  select max(m.date_start) into m_ult_gasto from crm_meta_ads_campaigns m where m.tenant_id is null and m.spend > 0;
  if m_ult_gasto is not null then
    m_dias_sem := hoje - m_ult_gasto;
    select coalesce(sum(m.spend),0) into m_gasto_antes from crm_meta_ads_campaigns m
     where m.tenant_id is null and m.date_start >= m_ult_gasto - 14 and m.date_start < m_ult_gasto;
  end if;

  with meta as (
    select * from crm_meta_ads_campaigns m where m.tenant_id is null and m.date_start >= v_ini and m.date_start < v_fim
  ),
  pagos as (
    select l.id, l.created_at, l.closed_at, l.opportunity_value, st.final_type
      from crm_leads l left join crm_stages st on st.id = l.stage_id
     where l.tenant_id is null
       and (l.meta_campaign_id is not null or l.meta_lead_id is not null or lower(coalesce(l.utm_source,'')) in ('facebook','fb','ig','instagram','meta'))
       and ((l.created_at >= t_ini and l.created_at < t_fim) or (l.closed_at >= t_ini and l.closed_at < t_fim))
  )
  select jsonb_build_object(
    'spend', (select coalesce(sum(spend),0) from meta),
    'tem_dados', (select count(*) > 0 from meta),
    'impressoes', (select coalesce(sum(impressions),0) from meta),
    'cliques', (select coalesce(sum(clicks),0) from meta),
    'leads_meta', (select coalesce(sum(leads),0) from meta),
    'leads_pagos_crm', (select count(*) from pagos where created_at >= t_ini and created_at < t_fim),
    'vendas_leads_pagos', (select count(*) from pagos where final_type = 'won' and closed_at >= t_ini and closed_at < t_fim),
    'receita_leads_pagos', (select coalesce(sum(opportunity_value),0) from pagos where final_type = 'won' and closed_at >= t_ini and closed_at < t_fim),
    'custo_discador', null,
    'meta', jsonb_build_object('conectada', m_tem_conta, 'conta', m_nome, 'ad_account_id', m_act, 'account_row_id', m_id,
              'ultimo_sync', m_sync, 'horas_desde_sync', m_horas, 'ultimo_dia_com_gasto', m_ult_gasto, 'dias_sem_gasto', m_dias_sem,
              'situacao', m_situacao, 'pre_paga', m_pre, 'saldo', m_saldo, 'devido', m_devido, 'forma_pagamento', m_forma,
              'media_dia', m_media, 'dias_de_saldo', m_dias_saldo, 'saldo_conferido_em', m_saldo_em, 'saldo_erro', m_saldo_erro, 'nivel_saldo', m_nivel),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', y.date_start, 'spend', y.s, 'leads', y.l, 'impressoes', y.i, 'cliques', y.c, 'campanhas', y.n) order by y.date_start), '[]')
                  from (select date_start, sum(spend) s, sum(leads) l, sum(impressions) i, sum(clicks) c, count(*) filter (where spend > 0) n from meta group by 1) y),
    'campanhas', (select coalesce(jsonb_agg(x order by (x->>'spend')::numeric desc), '[]') from (
        select jsonb_build_object('nome', (array_agg(g.campaign_name order by g.date_start desc))[1], 'campaign_id', g.campaign_id, 'spend', sum(g.spend), 'leads', sum(g.leads),
                 'impressoes', sum(g.impressions), 'cliques', sum(g.clicks), 'status', (array_agg(g.status order by g.date_start desc))[1],
                 'objetivo', max(g.objective), 'dias', count(*) filter (where g.spend > 0),
                 'leads_crm', (select count(*) from crm_leads l where l.meta_campaign_id = g.campaign_id and l.created_at >= t_ini and l.created_at < t_fim),
                 'vendas_crm', (select count(*) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_campaign_id = g.campaign_id and st.final_type = 'won' and l.closed_at >= t_ini and l.closed_at < t_fim),
                 'receita_crm', (select coalesce(sum(l.opportunity_value),0) from crm_leads l join crm_stages st on st.id = l.stage_id where l.meta_campaign_id = g.campaign_id and st.final_type = 'won' and l.closed_at >= t_ini and l.closed_at < t_fim)) x
          from meta g group by g.campaign_id order by sum(g.spend) desc limit 30) y)
  ) into tra;

  tra := tra || jsonb_build_object(
    'cpl', case when (tra->>'leads_meta')::int > 0 then (tra->>'spend')::numeric / (tra->>'leads_meta')::int end,
    'roas', case when (tra->>'spend')::numeric > 0 then (tra->>'receita_leads_pagos')::numeric / (tra->>'spend')::numeric end,
    'cac', case when (tra->>'spend')::numeric > 0 and (com->>'vendas')::int > 0 then (tra->>'spend')::numeric / (com->>'vendas')::int end,
    'custo_reuniao_agendada', case when (tra->>'spend')::numeric > 0 and (com->>'agendadas')::int > 0 then (tra->>'spend')::numeric / (com->>'agendadas')::int end,
    'custo_reuniao_realizada', case when (tra->>'spend')::numeric > 0 and (com->>'realizadas')::int > 0 then (tra->>'spend')::numeric / (com->>'realizadas')::int end);

  ---------------------------------------------------------------- clientes / entrega
  select count(*) into n_aviso from onboarding_projects p join onboarding_companies c on c.id = p.onboarding_company_id
   where c.status = 'active' and p.status in ('notice_period','cancellation_signaled');

  select count(*) into n_vencendo from onboarding_companies c
   where c.status = 'active' and coalesce(c.is_simulator,false) = false and c.tenant_id is null
     and coalesce(c.renewal_plan_type,'monthly') not in ('monthly','mensal')
     and c.contract_end_date between hoje and hoje + 30;

  select count(*) into n_checkup from produto_checkup_itens i
   where i.dia = hoje and i.tratado_em is null;

  select count(*) into n_nps_baixo from onboarding_nps_responses n join onboarding_projects p on p.id = n.project_id
    join onboarding_companies c on c.id = p.onboarding_company_id
   where c.status = 'active' and n.created_at >= t_ini and n.created_at < t_fim and n.score <= 6;

  with emp as (
    select c.id, c.name, c.consultant_id, c.cs_id, c.contract_value, c.renewal_plan_type, c.contract_end_date, c.contract_start_date
      from onboarding_companies c
     where c.status = 'active' and coalesce(c.is_simulator,false) = false and c.tenant_id is null
  ),
  proj as (
    select p.id, p.onboarding_company_id cid, p.status from onboarding_projects p join emp e on e.id = p.onboarding_company_id
     where p.status in ('active','notice_period','cancellation_signaled')
  ),
  saude as (
    -- um score por empresa: empresa com dois projetos ativos pega o mais recente
    select distinct on (pr.cid) pr.cid, h.total_score, h.risk_level, h.trend_direction
      from client_health_scores h join proj pr on pr.id = h.project_id order by pr.cid, h.updated_at desc
  ),
  tarefas as (
    select t.responsible_staff_id, pr.cid, count(*) n
      from onboarding_tasks t join proj pr on pr.id = t.project_id
     where t.status::text in ('pending','in_progress') and t.due_date < hoje group by 1, 2
  )
  select jsonb_build_object(
    'ativas', (select count(*) from emp),
    'em_aviso', n_aviso,
    'novos', (select count(*) from onboarding_companies c where c.tenant_id is null and coalesce(c.is_simulator,false) = false
               and c.contract_start_date >= v_ini and c.contract_start_date < v_fim),
    'novos_lista', (select coalesce(jsonb_agg(jsonb_build_object('empresa', c.name, 'company_id', c.id, 'valor', c.contract_value, 'inicio', c.contract_start_date, 'plano', c.renewal_plan_type) order by c.contract_start_date), '[]')
                    from onboarding_companies c where c.tenant_id is null and coalesce(c.is_simulator,false) = false
                     and c.contract_start_date >= v_ini and c.contract_start_date < v_fim),
    'churn_n', (select count(*) from onboarding_projects p where p.churn_date >= t_ini and p.churn_date < t_fim and p.status in ('closed','completed')),
    'churn_valor', (select coalesce(sum(c.contract_value),0) from onboarding_projects p join onboarding_companies c on c.id = p.onboarding_company_id
                     where p.churn_date >= t_ini and p.churn_date < t_fim and p.status in ('closed','completed')),
    'churn_lista', (select coalesce(jsonb_agg(jsonb_build_object('empresa', c.name, 'company_id', c.id, 'valor', c.contract_value, 'data', (p.churn_date at time zone v_tz)::date, 'motivo', p.churn_reason) order by p.churn_date), '[]')
                    from onboarding_projects p join onboarding_companies c on c.id = p.onboarding_company_id
                     where p.churn_date >= t_ini and p.churn_date < t_fim and p.status in ('closed','completed')),
    'vencendo_30d', (select coalesce(jsonb_agg(jsonb_build_object('empresa', e.name, 'company_id', e.id, 'fim', e.contract_end_date, 'plano', e.renewal_plan_type, 'valor', e.contract_value, 'dias', e.contract_end_date - hoje) order by e.contract_end_date), '[]')
                     from emp e where coalesce(e.renewal_plan_type,'monthly') not in ('monthly','mensal') and e.contract_end_date between hoje and hoje + 30),
    'vencendo_30d_n', n_vencendo,
    'health', jsonb_build_object(
        'media', (select round(avg(total_score),1) from saude),
        'n', (select count(*) from saude),
        'excellent', (select count(*) from saude where risk_level = 'excellent'),
        'healthy', (select count(*) from saude where risk_level = 'healthy'),
        'attention', (select count(*) from saude where risk_level = 'attention'),
        'at_risk', (select count(*) from saude where risk_level = 'at_risk'),
        'critical', (select count(*) from saude where risk_level = 'critical')),
    'health_baixo', (select coalesce(jsonb_agg(jsonb_build_object('empresa', e.name, 'company_id', e.id, 'score', s.total_score, 'nivel', s.risk_level, 'tendencia', s.trend_direction, 'consultor', st.name) order by s.total_score), '[]')
                     from saude s join emp e on e.id = s.cid left join onboarding_staff st on st.id = e.consultant_id
                     where s.risk_level in ('critical','at_risk')),
    'nps', (select round(avg(n.score),1) from onboarding_nps_responses n where n.created_at >= t_ini and n.created_at < t_fim),
    'nps_n', (select count(*) from onboarding_nps_responses n where n.created_at >= t_ini and n.created_at < t_fim),
    'nps_baixo_n', n_nps_baixo,
    'csat', (select round(avg(r.score),1) from csat_responses r where coalesce(r.responded_at, r.created_at) >= t_ini and coalesce(r.responded_at, r.created_at) < t_fim),
    'csat_n', (select count(*) from csat_responses r where coalesce(r.responded_at, r.created_at) >= t_ini and coalesce(r.responded_at, r.created_at) < t_fim),
    'tarefas_atrasadas', (select coalesce(sum(n),0) from tarefas),
    'tarefas_por_responsavel', (select coalesce(jsonb_agg(x order by (x->>'n')::int desc), '[]') from (
        select jsonb_build_object('staff_id', t.responsible_staff_id, 'nome', coalesce(s.name, 'Sem responsável'), 'n', sum(t.n), 'empresas', count(distinct t.cid)) x
          from tarefas t left join onboarding_staff s on s.id = t.responsible_staff_id group by t.responsible_staff_id, s.name) y),
    'checkup_pendentes', n_checkup,
    'checkup_por_bloco', (select coalesce(jsonb_agg(jsonb_build_object('bloco', bloco, 'n', n) order by n desc), '[]') from (
        select i.bloco, count(*) n from produto_checkup_itens i where i.dia = hoje and i.tratado_em is null group by 1) y),
    'por_consultor', (select coalesce(jsonb_agg(x order by (x->>'empresas')::int desc), '[]') from (
        select jsonb_build_object('staff_id', s.id, 'nome', s.name, 'papel', s.role,
                 'empresas', (select count(*) from emp e where e.consultant_id = s.id),
                 'health_media', (select round(avg(sd.total_score),1) from saude sd join emp e on e.id = sd.cid where e.consultant_id = s.id),
                 'criticas', (select count(*) from saude sd join emp e on e.id = sd.cid where e.consultant_id = s.id and sd.risk_level in ('critical','at_risk')),
                 'tarefas_atrasadas', (select coalesce(sum(t.n),0) from tarefas t where t.responsible_staff_id = s.id),
                 'em_aviso', (select count(*) from proj pr join emp e on e.id = pr.cid where e.consultant_id = s.id and pr.status <> 'active'),
                 'mensalidades', (select coalesce(sum(m.valor), 0) from painel_mrr_cobrancas() m join emp e on e.id = m.company_id where e.consultant_id = s.id and m.no_mrr)) x
          from onboarding_staff s where s.tenant_id is null and s.is_active and s.id in (select consultant_id from emp)) y)
  ) into cli;

  select count(*) into n_health_baixo from jsonb_array_elements(cli->'health_baixo');

  ---------------------------------------------------------------- atendimento
  select count(*) into n_conv_wait from crm_whatsapp_conversations c
   where c.status = 'open' and c.last_message_direction = 'inbound' and c.merged_into is null;
  select count(*) into n_conv24 from crm_whatsapp_conversations c
   where c.status = 'open' and c.last_message_direction = 'inbound' and c.merged_into is null and c.last_inbound_at < now() - interval '24 hours';

  with msgs as (
    select m.direction, coalesce(m.is_ai,false) eh_ia, m.conversation_id
      from crm_whatsapp_messages m join crm_whatsapp_conversations cvp on cvp.id = m.conversation_id
     where m.created_at >= t_ini and m.created_at < t_fim and m.deleted_at is null and not wa_conversa_pessoal(cvp.instance_id)
  )
  select jsonb_build_object(
    'conversas', (select count(distinct conversation_id) from msgs),
    'recebidas', (select count(*) from msgs where direction = 'inbound'),
    'enviadas', (select count(*) from msgs where direction = 'outbound'),
    'enviadas_ia', (select count(*) from msgs where direction = 'outbound' and eh_ia),
    'esperando', n_conv_wait,
    'esperando_24h', n_conv24,
    'esperando_lista', (select coalesce(jsonb_agg(x order by x->>'desde'), '[]') from (
        select jsonb_build_object('conversation_id', c.id, 'lead_id', c.lead_id, 'nome', coalesce(l.name, ct.name, ct.phone), 'desde', c.last_inbound_at,
                 'horas', round(extract(epoch from (now() - c.last_inbound_at))/3600), 'atendente', s.name, 'ultima', left(c.last_message, 90)) x
          from crm_whatsapp_conversations c left join crm_leads l on l.id = c.lead_id left join crm_whatsapp_contacts ct on ct.id = c.contact_id
          left join onboarding_staff s on s.id = c.assigned_to
         where c.status = 'open' and c.last_message_direction = 'inbound' and c.merged_into is null and c.last_inbound_at < now() - interval '24 hours'
         order by c.last_inbound_at limit 40) y),
    'por_atendente', (select coalesce(jsonb_agg(x order by (x->>'esperando')::int desc), '[]') from (
        select jsonb_build_object('nome', coalesce(s.name, 'Sem atendente'), 'esperando', count(*),
                 'mais_24h', count(*) filter (where c.last_inbound_at < now() - interval '24 hours')) x
          from crm_whatsapp_conversations c left join onboarding_staff s on s.id = c.assigned_to
         where c.status = 'open' and c.last_message_direction = 'inbound' and c.merged_into is null
         group by s.name) y)
  ) into ate;

  ---------------------------------------------------------------- IA e automações
  select coalesce(sum(custo_usd_estimado),0) into custo_ia from ai_usage_daily where dia >= v_ini and dia < v_fim;
  select teto_usd into teto_ia from ai_usage_config where id;
  select coalesce(sum(custo_usd_estimado),0) into custo_hoje from ai_usage_daily where dia = hoje;

  with runs as (
    select r.agent_id, r.mode, r.outcome, r.channel from crm_ai_agent_runs r where r.created_at >= t_ini and r.created_at < t_fim
  ),
  wa as (
    select count(*) n, coalesce(sum(coalesce((select wa_preco_servico_brl from ai_usage_config where id), (o.pricing_rates->>'UTILITY')::numeric, 0.04)),0) custo
      from crm_whatsapp_messages m join crm_whatsapp_conversations c on c.id = m.conversation_id
      join whatsapp_official_instances o on o.id = c.official_instance_id
     where m.direction = 'outbound' and m.deleted_at is null and m.created_at >= t_ini and m.created_at < t_fim
  )
  select jsonb_build_object(
    'custo_usd', round(custo_ia,2), 'teto_dia_usd', teto_ia, 'custo_hoje_usd', round(custo_hoje,2),
    'teto_mes_usd', case when teto_ia > 0 then teto_ia * extract(day from (v_fim - 1))::int end,
    'pct_teto_mes', case when teto_ia > 0 then round(custo_ia / (teto_ia * extract(day from (v_fim - 1))::int), 3) end,
    'pct_teto_hoje', case when teto_ia > 0 then round(custo_hoje / teto_ia, 3) end,
    'dolar', (select dolar from ai_usage_config where id),
    'custo_brl', case when (select dolar from ai_usage_config where id) > 0 then round(custo_ia * (select dolar from ai_usage_config where id), 2) end,
    'chamadas', (select coalesce(sum(chamadas),0) from ai_usage_daily where dia >= v_ini and dia < v_fim),
    'wa_msgs', (select n from wa), 'wa_custo', (select round(custo,2) from wa),
    'wa_teto', (select wa_teto_mes from ai_usage_config where id),
    'agentes_ativos', (select count(*) from crm_ai_agents a where a.is_active and a.tenant_id is null),
    'runs', (select count(*) from runs),
    'runs_enviadas', (select count(*) from runs where outcome like 'sent%'),
    'runs_auto', (select count(*) from runs where mode = 'auto' and outcome like 'sent%'),
    'runs_followup', (select count(*) from runs where mode = 'followup' and outcome like 'sent%'),
    'runs_opt_out', (select count(*) from runs where outcome = 'opt_out'),
    'por_agente', (select coalesce(jsonb_agg(x order by (x->>'enviadas')::int desc), '[]') from (
        select jsonb_build_object('id', a.id, 'nome', a.name, 'ativo', a.is_active, 'runs', count(r.*),
                 'enviadas', count(*) filter (where r.outcome like 'sent%'),
                 'followups', count(*) filter (where r.mode = 'followup' and r.outcome like 'sent%'),
                 'opt_out', count(*) filter (where r.outcome = 'opt_out')) x
          from crm_ai_agents a join runs r on r.agent_id = a.id where a.tenant_id is null group by a.id, a.name, a.is_active) y),
    'por_fn', (select coalesce(jsonb_agg(x order by (x->>'custo')::numeric desc), '[]') from (
        select jsonb_build_object('nome', fn, 'custo', round(sum(custo_usd_estimado),2), 'chamadas', sum(chamadas)) x
          from ai_usage_daily where dia >= v_ini and dia < v_fim group by fn order by sum(custo_usd_estimado) desc limit 15) y),
    'automacoes_ativas', (select count(*) from crm_automations a where a.is_active) + (select count(*) from automation_rules r where r.is_active),
    'automacoes_runs', (select count(*) from crm_automation_runs r where r.created_at >= t_ini and r.created_at < t_fim)
                       + (select count(*) from automation_executions e where e.executed_at >= t_ini and e.executed_at < t_fim)
  ) into ia;

  ---------------------------------------------------------------- roda sozinho
  select jsonb_build_object(
    'agente_respostas', (ia->>'runs_auto')::int,
    'agente_followups', (ia->>'runs_followup')::int,
    'cobrancas', (select count(*) from billing_notification_logs b where b.sent_at >= t_ini and b.sent_at < t_fim),
    'lembretes_reuniao', (select count(*) from crm_meeting_reminder_runs r where r.created_at >= t_ini and r.created_at < t_fim and coalesce(r.status,'') not in ('error','failed')),
    'automacoes_crm', (ia->>'automacoes_runs')::int,
    'disparos', (select coalesce(sum(total),0) from whatsapp_official_campaigns c where c.created_at >= t_ini and c.created_at < t_fim and c.status = 'done'),
    'leads_formulario_meta', (select count(*) from crm_leads l where l.tenant_id is null and l.meta_lead_id is not null and l.created_at >= t_ini and l.created_at < t_fim),
    'leads_sem_criador', (select count(*) from crm_leads l where l.tenant_id is null and l.created_by is null and l.created_at >= t_ini and l.created_at < t_fim),
    'followups_personalizados', (select count(*) from crm_lead_followups f where f.created_at >= t_ini and f.created_at < t_fim and f.status = 'sent'),
    'atividades_automaticas', (select count(*) from crm_activities a where a.is_automation and a.created_at >= t_ini and a.created_at < t_fim),
    'mensagens_ia', (ate->>'enviadas_ia')::int
  ) into roda;

  ---------------------------------------------------------------- equipe
  select coalesce(jsonb_agg(jsonb_build_object('papel', role, 'n', n) order by n desc), '[]') into equipe
    from (select role, count(*) n from onboarding_staff where is_active and tenant_id is null group by role) y;

  ---------------------------------------------------------------- série 12 meses
  with meses as (
    select generate_series(s_ini, (s_fim - interval '1 month')::date, interval '1 month')::date m
  ),
  rec as (select date_trunc('month', (i.paid_at at time zone v_tz))::date m, sum(coalesce(i.paid_amount_cents, i.amount_cents))/100.0 v, count(*) n
            from company_invoices i where i.status = 'paid' and i.paid_at >= ts_ini and i.paid_at < ts_fim group by 1),
  inv as (select date_trunc('month', i.due_date)::date m, count(*) n from company_invoices i where i.due_date >= s_ini and i.due_date < s_fim group by 1),
  pag as (select date_trunc('month', p.paid_date)::date m, sum(coalesce(p.paid_amount, p.amount)) v
            from financial_payables p where p.status = 'paid' and p.tenant_id is null and p.paid_date >= s_ini and p.paid_date < s_fim group by 1),
  ven as (select date_trunc('month', (l.closed_at at time zone v_tz))::date m, count(*) n, sum(coalesce(l.opportunity_value,0)) v
            from crm_leads l join crm_stages st on st.id = l.stage_id
           where st.final_type = 'won' and l.tenant_id is null and l.closed_at >= ts_ini and l.closed_at < ts_fim group by 1),
  led as (select date_trunc('month', (l.created_at at time zone v_tz))::date m, count(*) n,
                 count(*) filter (where p.counts_lead_inflow) n_inflow
            from crm_leads l left join crm_pipelines p on p.id = l.pipeline_id
           where l.tenant_id is null and l.created_at >= ts_ini and l.created_at < ts_fim group by 1),
  reu as (select date_trunc('month', (e.event_date at time zone v_tz))::date m,
                 count(*) filter (where e.event_type = 'scheduled') ag,
                 count(*) filter (where e.event_type in ('realized','realized_out_of_icp')) re,
                 count(*) filter (where e.event_type = 'no_show') ns
            from crm_meeting_events e where e.event_date >= ts_ini and e.event_date < ts_fim group by 1),
  met as (select date_trunc('month', m.date_start)::date m, sum(m.spend) v, sum(m.leads) n
            from crm_meta_ads_campaigns m where m.tenant_id is null and m.date_start >= s_ini and m.date_start < s_fim group by 1),
  iau as (select date_trunc('month', dia)::date m, sum(custo_usd_estimado) v from ai_usage_daily where dia >= s_ini and dia < s_fim group by 1),
  chu as (select date_trunc('month', (p.churn_date at time zone v_tz))::date m, count(*) n from onboarding_projects p
           where p.status in ('closed','completed') and p.churn_date >= ts_ini and p.churn_date < ts_fim group by 1),
  nov as (select date_trunc('month', c.contract_start_date)::date m, count(*) n from onboarding_companies c
           where c.tenant_id is null and coalesce(c.is_simulator,false) = false and c.contract_start_date >= s_ini and c.contract_start_date < s_fim group by 1),
  runs as (select date_trunc('month', (r.created_at at time zone v_tz))::date m, count(*) filter (where r.outcome like 'sent%') n
            from crm_ai_agent_runs r where r.created_at >= ts_ini and r.created_at < ts_fim group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'mes', to_char(x.m, 'YYYY-MM-DD'),
      'recebido', case when rec.m is not null or inv.m is not null then coalesce(rec.v,0) end, 'recebido_n', coalesce(rec.n,0),
      'pago', case when pag.m is not null then pag.v end,
      'lucro', case when (rec.m is not null or inv.m is not null) and pag.m is not null then coalesce(rec.v,0) - pag.v end,
      'vendas', case when led.m is not null or ven.m is not null then coalesce(ven.n,0) end, 'receita', case when led.m is not null or ven.m is not null then coalesce(ven.v,0) end,
      'leads', case when led.m is not null then led.n end, 'leads_inflow', case when led.m is not null then led.n_inflow end,
      'agendadas', case when led.m is not null or reu.m is not null then coalesce(reu.ag,0) end,
      'realizadas', case when led.m is not null or reu.m is not null then coalesce(reu.re,0) end,
      'no_show', case when led.m is not null or reu.m is not null then coalesce(reu.ns,0) end,
      'spend', case when met.m is not null then met.v end, 'leads_meta', case when met.m is not null then met.n end,
      'custo_ia', case when iau.m is not null then iau.v end,
      'churn', coalesce(chu.n,0), 'novos', coalesce(nov.n,0), 'agente_msgs', case when runs.m is not null then runs.n end
    ) order by x.m), '[]') into serie
    from meses x
    left join rec on rec.m = x.m left join inv on inv.m = x.m left join pag on pag.m = x.m left join ven on ven.m = x.m left join led on led.m = x.m
    left join reu on reu.m = x.m left join met on met.m = x.m left join iau on iau.m = x.m left join chu on chu.m = x.m
    left join nov on nov.m = x.m left join runs on runs.m = x.m;

  ---------------------------------------------------------------- alertas (estado de hoje)
  if n_venc7 > 0 then
    alertas := alertas || jsonb_build_object('area','financeiro','gravidade', case when v_venc7 >= 5000 then 'alta' else 'media' end,
      'titulo', n_venc7 || ' fatura' || case when n_venc7 > 1 then 's' else '' end || ' vencida' || case when n_venc7 > 1 then 's' else '' end || ' há mais de 7 dias',
      'detalhe', 'R$ ' || replace(to_char(v_venc7, 'FM999G999G990'), ',', '.') || ' parados. Cobrar ou negociar hoje.',
      'link', '/onboarding-tasks/financeiro', 'view', 'financeiro');
  end if;
  if v_saldo < v_pagar7 then
    alertas := alertas || jsonb_build_object('area','financeiro','gravidade','alta',
      'titulo', 'Saldo em banco abaixo das contas da semana',
      'detalhe', 'Saldo R$ ' || replace(to_char(v_saldo, 'FM999G999G990'), ',', '.') || ' contra R$ ' || replace(to_char(v_pagar7, 'FM999G999G990'), ',', '.') || ' a pagar em 7 dias. Saldo é o do Nexus, confira no banco.',
      'link', '/onboarding-tasks/financeiro', 'view', 'financeiro');
  end if;
  if n_pagar3 > 0 then
    alertas := alertas || jsonb_build_object('area','financeiro','gravidade','media',
      'titulo', n_pagar3 || ' conta' || case when n_pagar3 > 1 then 's' else '' end || ' a pagar vence' || case when n_pagar3 > 1 then 'm' else '' end || ' em 3 dias',
      'detalhe', 'R$ ' || replace(to_char(v_pagar3, 'FM999G999G990'), ',', '.') || ' até ' || to_char(hoje + 3, 'DD/MM') || '.',
      'link', '/onboarding-tasks/financeiro', 'view', 'financeiro');
  end if;
  -- Meta Ads: conexão, saldo e investimento
  if not m_tem_conta then
    alertas := alertas || jsonb_build_object('area','trafego','gravidade','alta',
      'titulo', 'Sem conta do Meta Ads conectada',
      'detalhe', 'O painel fica sem investimento, CPL e ROAS. Conecte em CRM, Tráfego Pago.',
      'link', '/crm', 'view', 'trafego');
  else
    if m_horas is null or m_horas > 8 then
      alertas := alertas || jsonb_build_object('area','trafego','gravidade','alta',
        'titulo', case when m_horas is null then 'Meta Ads conectado, mas nunca sincronizou'
                       when m_horas >= 48 then 'Meta Ads não sincroniza há ' || floor(m_horas / 24)::int || ' dias'
                       else 'Meta Ads não sincroniza há ' || round(m_horas)::int || ' horas' end,
        'detalhe', 'A sincronização roda sozinha de 2 em 2 horas. Parada assim é acesso vencido ou conexão caída. Reconecte em CRM, Tráfego Pago.',
        'link', '/crm', 'view', 'trafego');
    end if;
    -- saldo da conta pré-paga: zerado, crítico ou baixo (o nível quem calcula é a edge do saldo)
    if m_nivel = 'zerado' then
      alertas := alertas || jsonb_build_object('area','trafego','gravidade','alta',
        'titulo', 'Saldo do Meta Ads zerado',
        'detalhe', 'Campanhas ativas não entregam sem crédito. Recarregue no Gerenciador de Anúncios.'
                   || case when m_ult_gasto is not null and m_dias_sem >= 1 then ' Sem gasto desde ' || to_char(m_ult_gasto, 'DD/MM') || '.' else '' end,
        'link', '/crm', 'view', 'trafego');
    elsif m_nivel in ('critico','baixo') then
      alertas := alertas || jsonb_build_object('area','trafego','gravidade', case when m_nivel = 'critico' then 'alta' else 'media' end,
        'titulo', 'Saldo do Meta Ads no fim: R$ ' || replace(to_char(m_saldo, 'FM999G999G990'), ',', '.')
                  || case when m_dias_saldo is not null then ', dá pra ' || replace(m_dias_saldo::text, '.', ',') || ' dia' || case when m_dias_saldo = 1 then '' else 's' end else '' end,
        'detalhe', 'Campanhas ativas não entregam sem crédito. Recarregue no Gerenciador de Anúncios.',
        'link', '/crm', 'view', 'trafego');
    end if;
    -- sem investimento: só com o sync em dia (senão é falta de dado) e só quando a
    -- causa não é saldo zerado (aí o alerta de cima já diz o porquê)
    if m_horas is not null and m_horas <= 8 and coalesce(m_nivel,'') <> 'zerado'
       and m_ult_gasto is not null and m_dias_sem >= 2 and coalesce(m_gasto_antes,0) > 0 then
      alertas := alertas || jsonb_build_object('area','trafego','gravidade','media',
        'titulo', 'Sem investimento no Meta há ' || m_dias_sem || ' dias',
        'detalhe', 'Último dia com gasto: ' || to_char(m_ult_gasto, 'DD/MM') || '. Nos 14 dias antes foram R$ ' || replace(to_char(m_gasto_antes, 'FM999G999G990'), ',', '.') || '. Tem saldo na conta: campanha pausada ou cartão recusado.',
        'link', '/crm', 'view', 'trafego');
    end if;
  end if;
  if n_vencendo > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade','media',
      'titulo', n_vencendo || ' contrato' || case when n_vencendo > 1 then 's' else '' end || ' vence' || case when n_vencendo > 1 then 'm' else '' end || ' em 30 dias',
      'detalhe', 'Sem renovação registrada. Marcar reunião de renovação.',
      'link', '/onboarding-tasks/companies', 'view', 'clientes');
  end if;
  if n_aviso > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade','alta',
      'titulo', n_aviso || ' cliente' || case when n_aviso > 1 then 's' else '' end || ' em aviso de saída',
      'detalhe', 'R$ ' || replace(to_char((fin->>'mrr_em_aviso')::numeric, 'FM999G999G990'), ',', '.') || ' de mensalidade em risco. Ligar antes que vire churn.',
      'link', '/onboarding-tasks/companies', 'view', 'clientes');
  end if;
  if n_ganhos_sem_valor > 0 then
    alertas := alertas || jsonb_build_object('area','comercial','gravidade','media',
      'titulo', n_ganhos_sem_valor || ' venda' || case when n_ganhos_sem_valor > 1 then 's' else '' end || ' ganha' || case when n_ganhos_sem_valor > 1 then 's' else '' end || ' sem valor no mês',
      'detalhe', 'Lead em estágio ganho com valor zerado. A receita vendida está subestimada.',
      'link', '/crm/leads', 'view', 'comercial');
  end if;
  if n_conv24 > 0 then
    alertas := alertas || jsonb_build_object('area','atendimento','gravidade', case when n_conv24 >= 50 then 'alta' else 'media' end,
      'titulo', n_conv24 || ' conversa' || case when n_conv24 > 1 then 's' else '' end || ' sem resposta há mais de 24 h',
      'detalhe', 'Cliente ou lead mandou a última mensagem e ninguém respondeu. ' || n_conv_wait || ' esperando no total.',
      'link', '/crm/inbox', 'view', 'atendimento');
  end if;
  if teto_ia > 0 and custo_hoje >= 0.8 * teto_ia then
    alertas := alertas || jsonb_build_object('area','ia','gravidade', case when custo_hoje >= teto_ia then 'alta' else 'media' end,
      'titulo', 'Custo de IA de hoje em ' || round(100 * custo_hoje / teto_ia) || '% do teto diário',
      'detalhe', 'US$ ' || round(custo_hoje,2) || ' hoje contra teto de US$ ' || teto_ia || ' por dia. No mês: US$ ' || round(custo_ia,2) || '.',
      'link', '/onboarding-tasks/custo-ia', 'view', 'ia');
  end if;
  if n_health_baixo > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade', case when n_health_baixo >= 10 then 'alta' else 'media' end,
      'titulo', n_health_baixo || ' cliente' || case when n_health_baixo > 1 then 's' else '' end || ' com health score crítico ou em risco',
      'detalhe', 'De ' || (cli->>'ativas') || ' ativos. Ver a lista e cobrar plano de ação do consultor.',
      'link', '/onboarding-tasks/companies', 'view', 'clientes');
  end if;
  for lt in select * from jsonb_to_recordset(cli->'tarefas_por_responsavel') as t(staff_id uuid, nome text, n int, empresas int) where n >= 10 order by n desc loop
    alertas := alertas || jsonb_build_object('area','clientes','gravidade', case when lt.n >= 30 then 'alta' else 'media' end,
      'titulo', lt.nome || ' com ' || lt.n || ' tarefas atrasadas',
      'detalhe', 'Em ' || lt.empresas || ' cliente' || case when lt.empresas > 1 then 's' else '' end || '. Tarefa vencida sem conclusão.',
      'link', '/onboarding-tasks', 'view', 'clientes');
  end loop;
  if n_checkup > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade','baixa',
      'titulo', n_checkup || ' pendência' || case when n_checkup > 1 then 's' else '' end || ' no checkup de hoje',
      'detalhe', 'Itens do checkup diário do produto ainda sem tratamento.',
      'link', '/onboarding-tasks/checkup', 'view', 'clientes');
  end if;
  if n_nps_baixo > 0 then
    alertas := alertas || jsonb_build_object('area','clientes','gravidade','alta',
      'titulo', n_nps_baixo || ' NPS detrator' || case when n_nps_baixo > 1 then 'es' else '' end || ' no mês',
      'detalhe', 'Nota 6 ou menos de cliente ativo. Ligar pro cliente.',
      'link', '/onboarding-tasks/companies', 'view', 'clientes');
  end if;

  -- blocos "pra frente": os alertas deles entram na frente da fila (caixa negativo é o mais grave)
  frente := painel_frente_interno(v_ini);
  -- "Caixa fica negativo" já diz o que "Saldo em banco abaixo das contas da semana"
  -- diria, com data e tamanho do buraco: com o primeiro ativo, o segundo sai.
  if exists (select 1 from jsonb_array_elements(coalesce(frente->'alertas', '[]'::jsonb)) a where a->>'titulo' like 'Caixa fica negativo%') then
    select coalesce(jsonb_agg(a), '[]'::jsonb) into alertas
      from jsonb_array_elements(alertas) a where a->>'titulo' <> 'Saldo em banco abaixo das contas da semana';
  end if;
  alertas := coalesce(frente->'alertas', '[]'::jsonb) || alertas;
  -- os mais graves primeiro, mantendo a ordem dentro de cada gravidade
  select coalesce(jsonb_agg(x.a order by case x.a->>'gravidade' when 'alta' then 1 when 'media' then 2 else 3 end, x.i), '[]'::jsonb) into alertas
    from jsonb_array_elements(alertas) with ordinality x(a, i);

  return jsonb_build_object(
    'mes', to_char(v_ini, 'YYYY-MM-DD'), 'hoje', to_char(hoje, 'YYYY-MM-DD'), 'gerado_em', now(),
    'financeiro', fin, 'comercial', com, 'trafego', tra, 'clientes', cli, 'atendimento', ate, 'ia', ia,
    'roda_sozinho', roda, 'equipe', equipe, 'alertas', alertas, 'serie', serie, 'frente', frente - 'alertas');
end $function$;

CREATE OR REPLACE FUNCTION public.crm_atendimento_dashboard(p_from timestamp with time zone, p_to timestamp with time zone, p_atendente uuid DEFAULT NULL::uuid, p_setor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; v_esc jsonb; v_ids uuid[];
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- Recorte por papel (Fabrício, 30/09/2026): closer/sdr só o próprio; head a equipe comercial; master/admin tudo.
  v_esc := public.crm_escopo_atual();
  v_ids := public.crm_escopo_ids(v_esc);
  p_atendente := case when v_ids is null then p_atendente when p_atendente = any(v_ids) then p_atendente
                  when v_esc->>'papel' = 'head_comercial' then null else (v_esc->>'staff_id')::uuid end;

  with conv as (
    select c.id, 'whatsapp'::text plataforma, c.status, c.assigned_to, c.sector_id, c.lead_id, c.created_at, c.last_message_at,
           c.last_message_direction,
           coalesce(nullif(wi.display_name, ''), wi.instance_name, nullif(oi.display_name, ''), oi.phone_number, 'WhatsApp') canal,
           coalesce(nullif(ct.name, ''), ct.phone) contato
      from crm_whatsapp_conversations c
      left join whatsapp_instances wi on wi.id = c.instance_id
      left join whatsapp_official_instances oi on oi.id = c.official_instance_id
      left join crm_whatsapp_contacts ct on ct.id = c.contact_id
     where c.created_at >= p_from and c.created_at < p_to and c.merged_into is null
       and not wa_conversa_pessoal(c.instance_id)
       and (p_atendente is null or c.assigned_to = p_atendente)
       and (v_ids is null or c.assigned_to = any(v_ids))
       and (p_setor is null or c.sector_id = p_setor)
    union all
    select c.id, 'instagram', c.status, c.assigned_to, null::uuid, c.lead_id, c.created_at, c.last_message_at,
           (select m.direction from instagram_messages m where m.conversation_id = c.id order by coalesce(m.timestamp, m.created_at) desc limit 1),
           coalesce(nullif(ii.instagram_username, ''), ii.instance_name, 'Instagram'),
           coalesce(nullif(ct.name, ''), ct.username)
      from instagram_conversations c
      left join instagram_instances ii on ii.id = c.instance_id
      left join instagram_contacts ct on ct.id = c.contact_id
     where c.created_at >= p_from and c.created_at < p_to
       and (p_atendente is null or c.assigned_to = p_atendente)
       and (v_ids is null or c.assigned_to = any(v_ids))
       and p_setor is null
  ),
  tempos as (
    select cv.*, x.first_in, x.first_out, x.first_human,
           extract(epoch from (x.first_out - x.first_in)) inicio_s,
           extract(epoch from (x.first_human - x.first_in)) resposta_s,
           -- tempo ÚTIL: só os segundos dentro do expediente (crm_business_hours / crm_holidays, Brasília)
           case when x.first_out is not null then public.crm_business_seconds_between(x.first_in, x.first_out) end inicio_util_s,
           case when x.first_human is not null then public.crm_business_seconds_between(x.first_in, x.first_human) end resposta_util_s,
           -- a 1ª mensagem do cliente chegou fora do expediente?
           (x.first_in is not null and public.crm_business_seconds_between(x.first_in, x.first_in + interval '1 second') = 0) fora_expediente
      from conv cv
      left join lateral (
        select fi.first_in,
               (select min(m.created_at) from crm_whatsapp_messages m
                 where m.conversation_id = cv.id and m.direction = 'outbound' and m.deleted_at is null and m.created_at > fi.first_in) first_out,
               (select min(m.created_at) from crm_whatsapp_messages m
                 where m.conversation_id = cv.id and m.direction = 'outbound' and m.deleted_at is null
                   and m.sent_by is not null and coalesce(m.is_ai, false) = false and m.created_at > fi.first_in) first_human
          from (select min(m.created_at) first_in from crm_whatsapp_messages m
                 where m.conversation_id = cv.id and m.direction = 'inbound' and m.deleted_at is null) fi
         where cv.plataforma = 'whatsapp'
        union all
        select fi.first_in,
               (select min(coalesce(m.timestamp, m.created_at)) from instagram_messages m
                 where m.conversation_id = cv.id and m.direction = 'outbound' and coalesce(m.timestamp, m.created_at) > fi.first_in),
               (select min(coalesce(m.timestamp, m.created_at)) from instagram_messages m
                 where m.conversation_id = cv.id and m.direction = 'outbound'
                   and m.sent_by is not null and coalesce(m.is_ai, false) = false and coalesce(m.timestamp, m.created_at) > fi.first_in)
          from (select min(coalesce(m.timestamp, m.created_at)) first_in from instagram_messages m
                 where m.conversation_id = cv.id and m.direction = 'inbound') fi
         where cv.plataforma = 'instagram'
      ) x on true
  ),
  kpi as (
    select count(*) iniciadas,
           count(*) filter (where status = 'closed') finalizadas,
           count(*) filter (where status <> 'closed') abertas,
           count(*) filter (where status <> 'closed' and last_message_direction = 'inbound') aguardando,
           count(*) filter (where first_in is not null and first_out is null) sem_resposta,
           count(*) filter (where first_in is not null) recebidas,
           round(avg(inicio_s) filter (where inicio_s is not null and inicio_s >= 0)) inicio_medio_s,
           round(percentile_cont(0.5) within group (order by inicio_s) filter (where inicio_s is not null and inicio_s >= 0)) inicio_mediana_s,
           round(avg(resposta_s) filter (where resposta_s is not null and resposta_s >= 0)) resposta_media_s,
           count(*) filter (where inicio_s is not null and inicio_s <= 300) respondidas_5min,
           round(percentile_cont(0.5) within group (order by resposta_s) filter (where resposta_s is not null and resposta_s >= 0)) resposta_mediana_s,
           round(avg(inicio_util_s) filter (where inicio_util_s is not null)) inicio_util_medio_s,
           round(percentile_cont(0.5) within group (order by inicio_util_s) filter (where inicio_util_s is not null)) inicio_util_mediana_s,
           round(avg(resposta_util_s) filter (where resposta_util_s is not null)) resposta_util_media_s,
           round(percentile_cont(0.5) within group (order by resposta_util_s) filter (where resposta_util_s is not null)) resposta_util_mediana_s,
           count(*) filter (where inicio_util_s is not null and inicio_util_s <= 300) respondidas_5min_util,
           count(*) filter (where fora_expediente) fora_expediente,
           count(*) filter (where fora_expediente and first_out is null) fora_expediente_sem_resposta,
           round(avg(inicio_s) filter (where fora_expediente and inicio_s >= 0)) fora_expediente_espera_media_s,
           round(avg(inicio_s) filter (where not fora_expediente and inicio_s >= 0)) dentro_expediente_espera_media_s
      from tempos
  ),
  -- demanda: toda mensagem recebida no período, por dia da semana e hora (Brasília).
  -- Com filtro de atendente/setor, só as conversas dele.
  entradas as (
    select (m.created_at at time zone 'America/Sao_Paulo') ts
      from crm_whatsapp_messages m
     where m.direction = 'inbound' and m.created_at >= p_from and m.created_at < p_to
       and not exists (select 1 from crm_whatsapp_conversations cp where cp.id = m.conversation_id and wa_conversa_pessoal(cp.instance_id))
       and ((p_atendente is null and p_setor is null and v_ids is null) or exists (
             select 1 from crm_whatsapp_conversations c where c.id = m.conversation_id
               and (p_atendente is null or c.assigned_to = p_atendente) and (p_setor is null or c.sector_id = p_setor)
               and (v_ids is null or c.assigned_to = any(v_ids))))
    union all
    select (coalesce(m.timestamp, m.created_at) at time zone 'America/Sao_Paulo')
      from instagram_messages m
     where m.direction = 'inbound' and coalesce(m.timestamp, m.created_at) >= p_from and coalesce(m.timestamp, m.created_at) < p_to
       and p_setor is null
       and ((p_atendente is null and v_ids is null) or exists (select 1 from instagram_conversations c where c.id = m.conversation_id
             and (p_atendente is null or c.assigned_to = p_atendente) and (v_ids is null or c.assigned_to = any(v_ids))))
  )
  select jsonb_build_object(
    'escopo', v_esc,
    -- expediente que está valendo (null = padrão da função: seg a sex, 08:00 às 18:00)
    'expediente', (select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'is_open', h.is_open, 'open', to_char(h.open_time, 'HH24:MI'), 'close', to_char(h.close_time, 'HH24:MI')) order by h.weekday) from crm_business_hours h),
    'feriados_periodo', (select count(*) from crm_holidays f where f.date >= (p_from at time zone 'America/Sao_Paulo')::date and f.date < (p_to at time zone 'America/Sao_Paulo')::date),
    'kpis', (select to_jsonb(k) from kpi k),
    'por_dia', (select coalesce(jsonb_agg(x order by x->>'dia'), '[]'::jsonb) from (
        select jsonb_build_object('dia', to_char((created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
                 'iniciadas', count(*), 'finalizadas', count(*) filter (where status = 'closed'),
                 'whatsapp', count(*) filter (where plataforma = 'whatsapp'), 'instagram', count(*) filter (where plataforma = 'instagram'),
                 'sem_resposta', count(*) filter (where first_in is not null and first_out is null),
                 'inicio_medio_s', round(avg(inicio_s) filter (where inicio_s >= 0)),
                 'inicio_util_medio_s', round(avg(inicio_util_s) filter (where inicio_util_s is not null)),
                 'fora_expediente', count(*) filter (where fora_expediente)) x
          from tempos group by (created_at at time zone 'America/Sao_Paulo')::date) y),
    'por_setor', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', tp.sector_id, 'nome', coalesce(s.name, 'Sem setor'), 'total', count(*),
                 'finalizadas', count(*) filter (where tp.status = 'closed'), 'abertas', count(*) filter (where tp.status <> 'closed'),
                 'resposta_media_s', round(avg(tp.inicio_s) filter (where tp.inicio_s >= 0)),
                 'resposta_util_media_s', round(avg(tp.inicio_util_s) filter (where tp.inicio_util_s is not null))) x
          from tempos tp left join crm_service_sectors s on s.id = tp.sector_id group by tp.sector_id, s.name) y),
    'por_atendente', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', tp.assigned_to, 'nome', coalesce(st.name, 'Sem atendente'), 'total', count(*),
                 'finalizadas', count(*) filter (where tp.status = 'closed'), 'abertas', count(*) filter (where tp.status <> 'closed'),
                 'aguardando', count(*) filter (where tp.status <> 'closed' and tp.last_message_direction = 'inbound'),
                 'sem_resposta', count(*) filter (where tp.first_in is not null and tp.first_out is null),
                 'resposta_media_s', round(avg(tp.inicio_s) filter (where tp.inicio_s >= 0)),
                 'humana_media_s', round(avg(tp.resposta_s) filter (where tp.resposta_s >= 0)),
                 'resposta_util_media_s', round(avg(tp.inicio_util_s) filter (where tp.inicio_util_s is not null)),
                 'humana_util_media_s', round(avg(tp.resposta_util_s) filter (where tp.resposta_util_s is not null)),
                 'recebidas', count(*) filter (where tp.first_in is not null),
                 'respondidas_5min', count(*) filter (where tp.inicio_s is not null and tp.inicio_s <= 300),
                 'respondidas_5min_util', count(*) filter (where tp.inicio_util_s is not null and tp.inicio_util_s <= 300),
                 'fora_expediente', count(*) filter (where tp.fora_expediente)) x
          from tempos tp left join onboarding_staff st on st.id = tp.assigned_to group by tp.assigned_to, st.name) y),
    'por_canal', (select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('nome', canal, 'plataforma', plataforma, 'total', count(*),
                 'finalizadas', count(*) filter (where status = 'closed'),
                 'sem_resposta', count(*) filter (where first_in is not null and first_out is null)) x from tempos group by canal, plataforma) y),
    'por_plataforma', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('nome', plataforma, 'total', count(*)) x from tempos group by plataforma) y),
    'mapa_calor', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('dow', dow, 'hora', hora, 'n', n) x
          from (select extract(isodow from ts)::int dow, extract(hour from ts)::int hora, count(*) n from entradas group by 1, 2) e) y),
    'lista', (select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
        select jsonb_build_object('id', tp.id, 'plataforma', tp.plataforma, 'contato', tp.contato, 'lead_id', tp.lead_id,
                 'status', tp.status, 'aguardando', (tp.status <> 'closed' and tp.last_message_direction = 'inbound'),
                 'atendente', st.name, 'setor', s.name, 'canal', tp.canal,
                 'created_at', tp.created_at, 'last_message_at', tp.last_message_at,
                 'resposta_s', tp.resposta_s, 'inicio_s', tp.inicio_s, 'recebeu', (tp.first_in is not null),
                 'inicio_util_s', tp.inicio_util_s, 'resposta_util_s', tp.resposta_util_s, 'fora_expediente', tp.fora_expediente) x
          from tempos tp left join onboarding_staff st on st.id = tp.assigned_to left join crm_service_sectors s on s.id = tp.sector_id
         order by tp.created_at desc limit 300) y)
  ) into v;
  return v;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_agent_leads_esperando(p_min_minutos integer DEFAULT 30, p_max_horas integer DEFAULT 24)
 RETURNS TABLE(conversation_id uuid, channel text, lead_id uuid, lead_name text, contato text, ult_lead timestamp with time zone, minutos integer, ultimo_run_outcome text, ultimo_run_erro text, ultimo_run_at timestamp with time zone, tentativas_depois integer, override_enabled boolean, override_por_pessoa boolean, ja_avisado boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with wa as (
    select m.conversation_id,
           max(m.created_at) filter (where m.direction='inbound') ult_lead,
           max(m.created_at) filter (where m.direction='outbound') ult_nossa,
           bool_or(m.direction='outbound' and m.is_ai) teve_ia
    from crm_whatsapp_messages m join crm_whatsapp_conversations cvp on cvp.id = m.conversation_id
    where m.created_at > now() - interval '7 days' and m.deleted_at is null and not wa_conversa_pessoal(cvp.instance_id)
    group by 1
  ), ig as (
    select m.conversation_id,
           max(m.created_at) filter (where m.direction='inbound') ult_lead,
           max(m.created_at) filter (where m.direction='outbound') ult_nossa,
           bool_or(m.direction='outbound' and m.is_ai) teve_ia
    from instagram_messages m
    where m.created_at > now() - interval '7 days' and coalesce(m.is_reaction,false) = false
    group by 1
  ), base as (
    select 'whatsapp'::text canal, w.conversation_id, c.lead_id, w.ult_lead, w.ult_nossa, w.teve_ia,
           coalesce(l.name, ct.name, ct.phone) lead_name, ct.phone contato
    from wa w join crm_whatsapp_conversations c on c.id = w.conversation_id
    left join crm_whatsapp_contacts ct on ct.id = c.contact_id
    left join crm_leads l on l.id = c.lead_id
    union all
    select 'instagram', i.conversation_id, c.lead_id, i.ult_lead, i.ult_nossa, i.teve_ia,
           coalesce(l.name, ct.name, ct.username), ct.username
    from ig i join instagram_conversations c on c.id = i.conversation_id
    left join instagram_contacts ct on ct.id = c.contact_id
    left join crm_leads l on l.id = c.lead_id
  )
  select b.conversation_id, b.canal, b.lead_id, b.lead_name, b.contato, b.ult_lead,
         (extract(epoch from now() - b.ult_lead) / 60)::int,
         r.outcome, r.error, r.created_at,
         (select count(*)::int from crm_ai_agent_runs x where x.conversation_id = b.conversation_id and x.created_at > b.ult_lead),
         o.enabled, (o.updated_by is not null),
         exists (select 1 from crm_agent_silence_alerts a where a.conversation_id = b.conversation_id and a.channel = b.canal and a.inbound_at = b.ult_lead and a.avisou)
  from base b
  left join crm_leads l on l.id = b.lead_id
  left join crm_stages st on st.id = l.stage_id
  left join crm_ai_agent_conversation_overrides o on o.conversation_id = b.conversation_id and o.channel = b.canal
  left join lateral (
    select x.outcome, x.error, x.created_at from crm_ai_agent_runs x
    where x.conversation_id = b.conversation_id order by x.created_at desc limit 1
  ) r on true
  where b.teve_ia
    and b.ult_lead < now() - make_interval(mins => p_min_minutos)
    and b.ult_lead > now() - make_interval(hours => p_max_horas)
    and (b.ult_nossa is null or b.ult_nossa < b.ult_lead)
    and coalesce(st.final_type, '') not in ('won', 'lost')
  order by b.ult_lead desc;
$function$;

CREATE OR REPLACE FUNCTION public.check_instance_silence(_simular boolean DEFAULT false, _fora_de_hora boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  agora_sp timestamp := now() at time zone 'America/Sao_Paulo';
  r record;
  remetente record;
  v_url text;
  v_msg text;
  saida jsonb := '[]'::jsonb;
begin
  -- só em dia útil, das 11h às 19h59 (às 11h já dá pra ver 3h de silêncio desde as 8h)
  if not _fora_de_hora and (extract(isodow from agora_sp) > 5 or extract(hour from agora_sp) not between 11 and 19) then
    return saida;
  end if;

  for r in
    select i.id, i.instance_name, coalesce(i.display_name, i.instance_name) nome, ev.ultimo, ev.semana
      from public.whatsapp_instances i
      cross join lateral (
        select max(m.created_at) ultimo, count(*) semana
          from public.crm_whatsapp_messages m
          join public.crm_whatsapp_conversations cv on cv.id = m.conversation_id
         where cv.instance_id = i.id
           and m.created_at > now() - interval '7 days'
           and (m.direction = 'inbound' or (m.sent_by is null and not coalesce(m.is_ai, false)))
      ) ev
     where i.status = 'connected'
       and not coalesce(i.is_personal, false)
       and ev.semana >= 150                      -- número movimentado; o pouco usado fica horas quieto por natureza
       and ev.ultimo < now() - interval '3 hours'
  loop
    if exists (select 1 from public.wa_instance_silence_alerts a where a.instance_id = r.id and a.last_event_at = r.ultimo) then
      continue;                                  -- esse silêncio já foi avisado
    end if;

    v_msg := 'Nexus: o número ' || r.nome || ' está MUDO. Nada dele entra no CRM desde '
      || to_char(r.ultimo at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
      || ' (' || round(extract(epoch from (now() - r.ultimo)) / 3600) || 'h). O servidor mostra conectado, então a sessão travou. '
      || 'Reinicie ou reconecte por QR em Atendimento > Dispositivos. As respostas dos leads nesse intervalo não aparecem no sistema.';
    saida := saida || jsonb_build_object('numero', r.nome, 'ultimo_evento', r.ultimo, 'eventos_7d', r.semana, 'mensagem', v_msg);
    if _simular then continue; end if;

    -- quem avisa é outro número, que esteja funcionando
    select i.instance_name, i.api_url, i.api_key into remetente
      from public.whatsapp_instances i
     where i.status = 'connected' and i.api_key is not null and i.api_url is not null and i.id <> r.id
     order by (i.instance_name = 'fabricionunnes') desc, (i.instance_name = 'financeirounv') desc
     limit 1;
    if remetente is null then continue; end if;
    v_url := regexp_replace(remetente.api_url, '/+$', '') || '/message/sendText/' || remetente.instance_name;
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', remetente.api_key),
      body := jsonb_build_object('number', '5531989840003', 'text', v_msg),
      timeout_milliseconds := 25000
    );
    insert into public.wa_instance_silence_alerts (instance_id, last_event_at) values (r.id, r.ultimo) on conflict do nothing;
  end loop;
  return saida;
end $function$;
