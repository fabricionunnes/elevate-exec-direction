-- Gestão à vista do dono (Painel de Controle › Ao vivo). Pedido do Fabrício em 07/10/2026:
-- tudo numa tela só, em tela cheia, atualizado em tempo real: conversas, leads entrando,
-- lead em call, no-show, agendamentos, resultado do dia/semana/mês, meta x realizado,
-- financeiro do dia/semana/mês. A tela assina o realtime das tabelas e chama esta RPC.
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
    'ranking_closers', (select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc), '[]'::jsonb) from (
                          select jsonb_build_object('nome', coalesce(s.name,'Sem dono'), 'vendas', count(*), 'receita', sum(w.v)) x
                            from won w left join onboarding_staff s on s.id = w.staff group by s.name) q),
    'ranking_sdr', (select coalesce(jsonb_agg(x order by (x->>'agendamentos')::int desc), '[]'::jsonb) from (
                      select jsonb_build_object('nome', coalesce(s.name,'Sem crédito'), 'agendamentos', count(*), 'realizadas',
                               (select count(*) from ev e2 where e2.event_type in ('realized','realized_out_of_icp') and e2.staff = e.staff)) x
                        from ev e left join onboarding_staff s on s.id = e.staff where e.event_type = 'scheduled' group by e.staff, s.name) q),
    'feed', (select coalesce(jsonb_agg(f order by (f->>'ts') desc), '[]'::jsonb) from (
               (select jsonb_build_object('ts', ts, 'tipo', 'lead', 'texto', 'Lead novo: ' || coalesce(nome,'sem nome')) f from leads order by ts desc limit 8)
               union all (select jsonb_build_object('ts', ts, 'tipo', 'msg', 'texto', coalesce(contato,'Contato') || ': ' || left(regexp_replace(coalesce(content,''), '\s+', ' ', 'g'), 70)) from msgs where direction = 'inbound' order by ts desc limit 8)
               union all (select jsonb_build_object('ts', e.ts, 'tipo', e.event_type, 'texto', case e.event_type when 'scheduled' then 'Reunião agendada' when 'no_show' then 'No-show' when 'realized' then 'Reunião realizada' else e.event_type end || ': ' || coalesce(l.name, l.company, '')) from ev e left join crm_leads l on l.id = e.lead_id order by e.ts desc limit 8)
               union all (select jsonb_build_object('ts', ts, 'tipo', 'venda', 'texto', 'Venda: ' || coalesce(nome,'') || ' · R$ ' || to_char(v, 'FM999G999G990D00')) from won order by ts desc limit 8)
               union all (select jsonb_build_object('ts', r.ts, 'tipo', 'recebido', 'texto', 'Recebido: ' || coalesce(c.name,'') || ' · R$ ' || to_char(r.c/100.0, 'FM999G999G990D00')) from rec r left join onboarding_companies c on c.id = r.company_id order by r.ts desc limit 8)
             ) z(f) ))
  into r;
  return r;
end $$;

create or replace function public.painel_ao_vivo()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not is_master() then raise exception 'Só o master'; end if;
  return painel_ao_vivo_interno();
end $$;
revoke all on function public.painel_ao_vivo_interno() from public, anon, authenticated;
grant execute on function public.painel_ao_vivo() to authenticated;

-- eventos em tempo real das tabelas que a tela escuta e ainda não estavam na publicação
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='crm_meeting_events') then alter publication supabase_realtime add table public.crm_meeting_events; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='crm_calls') then alter publication supabase_realtime add table public.crm_calls; end if;
end $$;
