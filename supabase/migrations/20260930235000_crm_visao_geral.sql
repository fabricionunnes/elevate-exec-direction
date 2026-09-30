-- Visão geral do digital (aba principal do CRM Comercial, pedido do Fabrício em 30/09/2026).
-- Uma RPC devolve tudo que a aba mostra e que ainda não tinha consulta pronta, com os mesmos
-- critérios das outras abas: leads = criados no período fora das etapas exclude_from_lead_count;
-- vendas = crm_sales fora de funis de evento (Mansão/Palestra/Eventos), igual à aba Vendas;
-- reuniões = crm_meeting_events dedup por lead + tipo + minuto. Lead "pago" = veio com id de
-- campanha/lead da Meta, fbclid ou utm_source, ou origem/grupo com "tráfego" no nome.
-- Só dados da UNV (tenant_id nulo). Comparação com o período anterior de mesmo tamanho.

-- KPIs de uma janela (chamada duas vezes: período atual e anterior). Interna, sem grant.
create or replace function public.crm_visao_geral_janela(
  p_from timestamptz, p_to timestamptz, p_origin uuid, p_campaign text, p_product text, p_staff uuid
) returns jsonb
language sql stable security definer set search_path = public as $$
  with leads as (
    select l.id, l.opportunity_value::numeric valor,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago
      from crm_leads l
      left join crm_stages s on s.id = l.stage_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
     where l.tenant_id is null and l.created_at >= p_from and l.created_at < p_to
       and coalesce(s.exclude_from_lead_count, false) = false
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
  ),
  vendas as (
    select s.id, coalesce(s.revenue_value, 0)::numeric receita,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago
      from crm_sales s
      left join crm_leads l on l.id = s.lead_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
      left join crm_pipelines p on p.id = s.pipeline_id
     where s.sale_date >= (p_from at time zone 'America/Sao_Paulo')::date
       and s.sale_date <= ((p_to - interval '1 second') at time zone 'America/Sao_Paulo')::date
       and coalesce(p.name, '') !~* 'evento|mans[ãa]o|palestra'
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or s.product_name = p_product)
       and (p_staff is null or s.closer_staff_id = p_staff or s.sdr_staff_id = p_staff)
  ),
  reunioes as (
    select distinct on (e.lead_id, e.event_type, date_trunc('minute', e.event_date)) e.id, e.event_type
      from crm_meeting_events e
      left join crm_leads l on l.id = e.lead_id
     where e.event_date >= p_from and e.event_date < p_to
       and e.event_type in ('scheduled', 'realized', 'no_show')
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or e.credited_staff_id = p_staff or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
  )
  select jsonb_build_object(
    'receita', (select coalesce(sum(receita), 0) from vendas),
    'receita_pagos', (select coalesce(sum(receita) filter (where pago), 0) from vendas),
    'vendas', (select count(*) from vendas),
    'leads', (select count(*) from leads),
    'leads_pagos', (select count(*) filter (where pago) from leads),
    'agendados', (select count(*) filter (where event_type = 'scheduled') from reunioes),
    'realizados', (select count(*) filter (where event_type = 'realized') from reunioes),
    'no_show', (select count(*) filter (where event_type = 'no_show') from reunioes),
    'ligacoes', (select count(*) from crm_calls c where c.tenant_id is null and c.created_at >= p_from and c.created_at < p_to and (p_staff is null or c.agent_staff_id = p_staff)),
    'msgs_wa', (select count(*) from crm_whatsapp_messages m where m.direction = 'inbound' and m.created_at >= p_from and m.created_at < p_to),
    'msgs_ig', (select count(*) from instagram_messages m where m.direction = 'inbound' and coalesce(m.timestamp, m.created_at) >= p_from and coalesce(m.timestamp, m.created_at) < p_to)
  );
$$;
revoke all on function public.crm_visao_geral_janela(timestamptz, timestamptz, uuid, text, text, uuid) from public;

create or replace function public.crm_visao_geral(
  p_from timestamptz, p_to timestamptz, p_origin uuid default null, p_campaign text default null,
  p_product text default null, p_staff uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  d_from date := (p_from at time zone 'America/Sao_Paulo')::date;
  d_to date := ((p_to - interval '1 second') at time zone 'America/Sao_Paulo')::date;  -- último dia incluído
  v_prev_from timestamptz := p_from - (p_to - p_from);
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  with leads as (
    select l.id, l.name, l.company, l.created_at, l.owner_staff_id, l.sdr_staff_id, l.closer_staff_id, l.origin_id, l.pipeline_id, l.stage_id,
           upper(trim(l.state)) uf, l.opportunity_value::numeric valor, l.last_activity_at, l.meta_campaign_id, l.campaign_name,
           coalesce(s.is_final, false) is_final, s.sort_order etapa_ordem,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago,
           coalesce(o.name, nullif(l.origin, ''), 'Sem origem') origem, g.name grupo
      from crm_leads l
      left join crm_stages s on s.id = l.stage_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
     where l.tenant_id is null and l.created_at >= p_from and l.created_at < p_to
       and coalesce(s.exclude_from_lead_count, false) = false
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
  ),
  vendas as (
    select s.id, s.sale_date, coalesce(s.revenue_value, 0)::numeric receita, s.closer_staff_id, s.sdr_staff_id, s.lead_id, s.product_name,
           l.origin_id, upper(trim(l.state)) uf, l.meta_campaign_id, coalesce(l.name, l.company) lead_nome,
           coalesce(o.name, nullif(l.origin, ''), 'Sem origem') origem,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago
      from crm_sales s
      left join crm_leads l on l.id = s.lead_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
      left join crm_pipelines p on p.id = s.pipeline_id
     where s.sale_date >= d_from and s.sale_date <= d_to
       and coalesce(p.name, '') !~* 'evento|mans[ãa]o|palestra'
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or s.product_name = p_product)
       and (p_staff is null or s.closer_staff_id = p_staff or s.sdr_staff_id = p_staff)
  ),
  reunioes as (
    select distinct on (e.lead_id, e.event_type, date_trunc('minute', e.event_date))
           e.id, e.lead_id, e.event_type, e.event_date,
           coalesce(e.credited_staff_id, e.owner_staff_id, l.owner_staff_id) staff, l.sdr_staff_id, l.owner_staff_id
      from crm_meeting_events e
      left join crm_leads l on l.id = e.lead_id
     where e.event_date >= p_from and e.event_date < p_to
       and e.event_type in ('scheduled', 'realized', 'no_show')
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or e.credited_staff_id = p_staff or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
  ),
  -- meta de Vendas (R$) dos meses que o período toca, pró-rata pelos dias do período em cada mês.
  -- Mesma regra da aba Vendas: head comercial e staff inativo não entram no time.
  meses as (
    select generate_series(date_trunc('month', d_from), date_trunc('month', d_to), interval '1 month')::date m
  ),
  meta as (
    select sum(gv.meta_value) meta_mes, m.m,
           (least(d_to, (m.m + interval '1 month' - interval '1 day')::date) - greatest(d_from, m.m) + 1)::numeric dias_no_periodo,
           extract(day from (m.m + interval '1 month' - interval '1 day'))::numeric dias_do_mes
      from meses m
      join crm_goal_values gv on gv.month = extract(month from m.m) and gv.year = extract(year from m.m)
      join crm_goal_types gt on gt.id = gv.goal_type_id and gt.name = 'Vendas' and gt.is_active
      join onboarding_staff st on st.id = gv.staff_id and coalesce(st.is_active, true) and coalesce(st.role, '') <> 'head_comercial'
     where p_staff is null or gv.staff_id = p_staff
     group by m.m
  ),
  -- funil: contatado = teve atividade, ligação ou mensagem enviada; qualificado = passou da 1ª etapa ou tem reunião
  funil as (
    select count(*) leads,
           count(*) filter (where l.last_activity_at is not null
             or exists (select 1 from crm_activities a where a.lead_id = l.id)
             or exists (select 1 from crm_calls c where c.lead_id = l.id)
             or exists (select 1 from crm_whatsapp_conversations cv join crm_whatsapp_messages m on m.conversation_id = cv.id
                         where cv.lead_id = l.id and m.direction = 'outbound')) contatados,
           count(*) filter (where l.etapa_ordem > (select min(s2.sort_order) from crm_stages s2 where s2.pipeline_id = l.pipeline_id)
             or exists (select 1 from crm_meeting_events e where e.lead_id = l.id)) qualificados
      from leads l
  ),
  vivos as (
    select l.id, l.name, l.company, l.opportunity_value::numeric valor, l.owner_staff_id, l.created_at,
           coalesce(l.stage_entered_at, l.entered_pipeline_at, l.created_at) etapa_desde, s.name etapa, s.sort_order, p.name funil
      from crm_leads l
      join crm_stages s on s.id = l.stage_id
      join crm_pipelines p on p.id = l.pipeline_id
      left join crm_origins o on o.id = l.origin_id
     where l.tenant_id is null and coalesce(s.is_final, false) = false and p.is_active
       and coalesce(s.exclude_from_lead_count, false) = false
       and l.created_at > now() - interval '120 days'
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
  ),
  -- pré-vendas = SDRs ativos + quem creditou agendamento no período (mesmo inativo, ex.: férias)
  sdrs as (
    select st.id, st.name from onboarding_staff st
     where ((coalesce(st.is_active, true) and st.role in ('sdr', 'social_setter', 'bdr'))
        or st.id in (select r.staff from reunioes r where r.event_type = 'scheduled')
        or st.id in (select l.sdr_staff_id from leads l where l.sdr_staff_id is not null))
       and (p_staff is null or st.id = p_staff)
  ),
  closers as (
    select st.id, st.name from onboarding_staff st
     where (st.id in (select v.closer_staff_id from vendas v where v.closer_staff_id is not null)
        or st.id in (select r.staff from reunioes r where r.event_type = 'realized'))
       and coalesce(st.role, '') not in ('sdr', 'social_setter', 'bdr')
       and (p_staff is null or st.id = p_staff)
  )
  select jsonb_build_object(
    'atual', crm_visao_geral_janela(p_from, p_to, p_origin, p_campaign, p_product, p_staff),
    'anterior', crm_visao_geral_janela(v_prev_from, p_from, p_origin, p_campaign, p_product, p_staff),
    'periodo', jsonb_build_object('de', d_from, 'ate', d_to, 'dias', (d_to - d_from) + 1, 'anterior_de', (v_prev_from at time zone 'America/Sao_Paulo')::date),
    'meta', jsonb_build_object(
      'mes_total', (select coalesce(sum(meta_mes), 0) from meta),
      'prorata', (select coalesce(sum(meta_mes * dias_no_periodo / dias_do_mes), 0) from meta)),
    'receita_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'receita', r) order by d), '[]'::jsonb)
                      from (select sale_date d, sum(receita) r from vendas group by sale_date) x),
    'funil', (select jsonb_build_object('leads', f.leads, 'contatados', f.contatados, 'qualificados', f.qualificados,
                 'agendados', (select count(distinct lead_id) from reunioes where event_type = 'scheduled'),
                 'realizados', (select count(distinct lead_id) from reunioes where event_type = 'realized'),
                 'vendas', (select count(*) from vendas)) from funil f),
    'origens', (select coalesce(jsonb_agg(x order by (x->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', d.origin_id, 'nome', d.origem, 'grupo', max(d.grupo), 'pago', bool_or(d.pago),
                 'leads', count(*) filter (where d.k = 'l'), 'vendas', count(*) filter (where d.k = 'v'),
                 'receita', coalesce(sum(d.receita) filter (where d.k = 'v'), 0)) x
          from (select origin_id, origem, grupo, pago, 0::numeric receita, 'l' k from leads
                union all select origin_id, origem, null, pago, receita, 'v' from vendas) d
         group by d.origin_id, d.origem) y),
    'estados', (select coalesce(jsonb_agg(x order by (x->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('uf', coalesce(nullif(d.uf, ''), 'Sem UF'),
                 'leads', count(*) filter (where d.k = 'l'), 'clientes', count(*) filter (where d.k = 'v'),
                 'receita', coalesce(sum(d.receita) filter (where d.k = 'v'), 0)) x
          from (select uf, 0::numeric receita, 'l' k from leads union all select uf, receita, 'v' from vendas) d
         group by d.uf) y),
    'campanhas', (select coalesce(jsonb_agg(x order by (x->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('campaign_id', d.cid, 'nome', max(d.nome),
                 'leads', count(*) filter (where d.k = 'l'), 'vendas', count(*) filter (where d.k = 'v'),
                 'receita', coalesce(sum(d.receita) filter (where d.k = 'v'), 0)) x
          from (select meta_campaign_id cid, campaign_name nome, 0::numeric receita, 'l' k from leads where meta_campaign_id is not null
                union all select v.meta_campaign_id, null, v.receita, 'v' from vendas v where v.meta_campaign_id is not null) d
         group by d.cid) y),
    'leads_semana', (select coalesce(jsonb_agg(x order by x->>'semana'), '[]'::jsonb) from (
        select jsonb_build_object('semana', to_char(date_trunc('week', l.created_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD'),
                 'pagos', count(*) filter (where l.pago), 'organicos', count(*) filter (where not l.pago)) x
          from leads l group by date_trunc('week', l.created_at at time zone 'America/Sao_Paulo')) y),
    'sdrs', (select coalesce(jsonb_agg(x order by (x->>'agendados')::int desc, (x->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', s.id, 'nome', s.name,
                 'leads', (select count(*) from leads l where l.sdr_staff_id = s.id or l.owner_staff_id = s.id),
                 'agendados', (select count(*) from reunioes r where r.event_type = 'scheduled' and (r.staff = s.id or r.sdr_staff_id = s.id)),
                 'realizados', (select count(*) from reunioes r where r.event_type = 'realized' and (r.staff = s.id or r.sdr_staff_id = s.id)),
                 'no_show', (select count(*) from reunioes r where r.event_type = 'no_show' and (r.staff = s.id or r.sdr_staff_id = s.id))) x
          from sdrs s) y),
    'closers', (select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc, (x->>'vendas')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('id', c.id, 'nome', c.name,
                 'vendas', (select count(*) from vendas v where v.closer_staff_id = c.id),
                 'receita', (select coalesce(sum(receita), 0) from vendas v where v.closer_staff_id = c.id),
                 'realizados', (select count(*) from reunioes r where r.event_type = 'realized' and r.staff = c.id),
                 'agendados', (select count(*) from reunioes r where r.event_type = 'scheduled' and r.staff = c.id)) x
          from closers c) y),
    'pipeline_etapas', (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc, (x->>'qtd')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('etapa', etapa, 'funil', funil, 'qtd', count(*), 'valor', coalesce(sum(valor), 0),
                 'com_valor', count(*) filter (where valor > 0)) x
          from vivos group by etapa, funil order by coalesce(sum(valor), 0) desc, count(*) desc limit 12) y),
    'pipeline_total', (select jsonb_build_object('qtd', count(*), 'valor', coalesce(sum(valor), 0), 'com_valor', count(*) filter (where valor > 0)) from vivos),
    'leads_sem_dono_total', (select count(*) from leads l where l.owner_staff_id is null and not l.is_final),
    'leads_sem_dono', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'nome', coalesce(l.name, l.company, 'Lead'), 'sub', l.origem, 'valor', l.valor) order by l.created_at desc), '[]'::jsonb)
                         from (select * from leads l where l.owner_staff_id is null and not l.is_final order by l.created_at desc limit 30) l),
    'leads_parados_total', (select count(*) from vivos where etapa_desde < now() - interval '7 days'),
    'leads_parados', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'nome', coalesce(v.name, v.company, 'Lead'), 'sub', v.funil || ' / ' || v.etapa, 'valor', v.valor,
                          'dias', floor(extract(epoch from (now() - v.etapa_desde)) / 86400)::int) order by v.valor desc nulls last), '[]'::jsonb)
                        from (select * from vivos v where v.etapa_desde < now() - interval '7 days' order by v.valor desc nulls last, v.etapa_desde limit 30) v),
    'vendas_lista', (select coalesce(jsonb_agg(jsonb_build_object('id', v.lead_id, 'nome', coalesce(v.lead_nome, 'Venda'), 'sub', v.origem, 'valor', v.receita, 'dia', v.sale_date) order by v.sale_date desc), '[]'::jsonb) from vendas v)
  ) into v;
  return v;
end;
$$;
revoke all on function public.crm_visao_geral(timestamptz, timestamptz, uuid, text, text, uuid) from public;
grant execute on function public.crm_visao_geral(timestamptz, timestamptz, uuid, text, text, uuid) to authenticated;

create index if not exists idx_crm_sales_sale_date on public.crm_sales (sale_date);
create index if not exists idx_crm_meeting_events_date on public.crm_meeting_events (event_date);
create index if not exists idx_crm_calls_lead on public.crm_calls (lead_id);
