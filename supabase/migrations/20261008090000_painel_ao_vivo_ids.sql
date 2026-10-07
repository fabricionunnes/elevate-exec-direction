-- Gestão à vista: ids no ranking (closer, sdr, agente) pra abrir o detalhe filtrado (07/10/2026)
create or replace function public.painel_ao_vivo_interno()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
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
     where m.created_at >= d0 and m.created_at < d1 and coalesce(ct.phone,'') not like '120363%'),
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
                       where mm.direction = 'outbound' and mm.created_at >= m0 and mm.created_at < m1 and cv.lead_id in (select l.id from crm_leads l where l.tenant_id is null and l.created_at >= m0)),
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
end $$;

