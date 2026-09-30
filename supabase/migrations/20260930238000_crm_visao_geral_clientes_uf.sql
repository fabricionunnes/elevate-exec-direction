-- "Onde estão nossos clientes" passa a ser dos CLIENTES (Fabrício, 30/09/2026): leads com ganho no CRM
-- Comercial no histórico todo (+ carteira ativa de onboarding_companies sem contar duas vezes), com
-- receita ganha por UF. Leads do período viram informação secundária. Só o bloco 'estados' muda.
create or replace function public.crm_visao_geral(
  p_from timestamptz, p_to timestamptz, p_origin uuid default null, p_campaign text default null,
  p_product text default null, p_staff uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb; v_esc jsonb; v_ids uuid[];
  d_from date := (p_from at time zone 'America/Sao_Paulo')::date;
  d_to date := ((p_to - interval '1 second') at time zone 'America/Sao_Paulo')::date;  -- último dia incluído
  v_prev_from timestamptz := p_from - (p_to - p_from);
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- Recorte por papel (Fabrício, 30/09/2026): closer/sdr só o próprio; head a equipe comercial; master/admin tudo.
  v_esc := public.crm_escopo_atual();
  v_ids := public.crm_escopo_ids(v_esc);
  p_staff := case when v_ids is null then p_staff when p_staff = any(v_ids) then p_staff
                  when v_esc->>'papel' = 'head_comercial' then null else (v_esc->>'staff_id')::uuid end;

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
       and (v_ids is null or l.owner_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
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
       and (v_ids is null or s.closer_staff_id = any(v_ids) or s.sdr_staff_id = any(v_ids))
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
       and (v_ids is null or e.credited_staff_id = any(v_ids) or l.owner_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
  ),
  -- Clientes do CRM Comercial no histórico todo (o cliente continua cliente): lead em etapa de ganho
  -- ou com venda em crm_sales, fora dos funis de evento (mesma regra da aba Vendas). UF do lead;
  -- se faltar, a da empresa vinculada pelo projeto (onboarding_projects.crm_lead_id).
  clientes_crm as (
    select l.id,
           coalesce(nullif(upper(trim(l.state)), ''),
                    (select upper(trim(c.address_state)) from onboarding_projects pj join onboarding_companies c on c.id = pj.company_id
                      where pj.crm_lead_id = l.id and nullif(trim(c.address_state), '') is not null limit 1)) uf,
           (select coalesce(sum(s.revenue_value), 0) from crm_sales s where s.lead_id = l.id) receita
      from crm_leads l
      left join crm_stages st on st.id = l.stage_id
      left join crm_pipelines p on p.id = l.pipeline_id
     where l.tenant_id is null
       and (st.final_type = 'won' or exists (select 1 from crm_sales s where s.lead_id = l.id))
       and coalesce(p.name, '') !~* 'evento|mans[ãa]o|palestra'
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
       and (v_ids is null or l.owner_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
  ),
  -- carteira ativa (onboarding_companies): entra no mapa como anel; só conta como cliente novo quando não
  -- está ligada a um lead ganho. Sem recorte por pessoa (a empresa não tem dono comercial), então só no escopo geral.
  carteira as (
    select c.id, nullif(upper(trim(c.address_state)), '') uf,
           exists (select 1 from onboarding_projects pj join clientes_crm g on g.id = pj.crm_lead_id where pj.company_id = c.id) ligada
      from onboarding_companies c
     where c.status = 'active' and c.tenant_id is null and v_ids is null and p_staff is null and p_origin is null and p_campaign is null and p_product is null
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
     where (p_staff is null or gv.staff_id = p_staff) and (v_ids is null or gv.staff_id = any(v_ids))
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
       and (v_ids is null or l.owner_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
  ),
  -- pré-vendas = SDRs ativos + quem creditou agendamento no período (mesmo inativo, ex.: férias)
  sdrs as (
    select st.id, st.name from onboarding_staff st
     where ((coalesce(st.is_active, true) and st.role in ('sdr', 'social_setter', 'bdr'))
        or st.id in (select r.staff from reunioes r where r.event_type = 'scheduled')
        or st.id in (select l.sdr_staff_id from leads l where l.sdr_staff_id is not null))
       and (p_staff is null or st.id = p_staff)
       and (v_ids is null or st.id = any(v_ids))
  ),
  closers as (
    select st.id, st.name from onboarding_staff st
     where (st.id in (select v.closer_staff_id from vendas v where v.closer_staff_id is not null)
        or st.id in (select r.staff from reunioes r where r.event_type = 'realized'))
       and coalesce(st.role, '') not in ('sdr', 'social_setter', 'bdr')
       and (p_staff is null or st.id = p_staff)
       and (v_ids is null or st.id = any(v_ids))
  )
  select jsonb_build_object(
    'escopo', v_esc,
    'atual', crm_visao_geral_janela(p_from, p_to, p_origin, p_campaign, p_product, p_staff, v_ids),
    'anterior', crm_visao_geral_janela(v_prev_from, p_from, p_origin, p_campaign, p_product, p_staff, v_ids),
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
    'estados', (select coalesce(jsonb_agg(x order by (x->>'clientes')::int desc, (x->>'leads')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('uf', coalesce(d.uf, 'Sem UF'),
                 'leads', count(*) filter (where d.k = 'l'),
                 'ganhos', count(*) filter (where d.k = 'g'),
                 'ativos', count(*) filter (where d.k = 'a'),
                 'clientes', count(*) filter (where d.k = 'g' or (d.k = 'a' and not d.ligada)),
                 'receita', coalesce(sum(d.receita) filter (where d.k = 'g'), 0)) x
          from (select nullif(uf, '') uf, 0::numeric receita, 'l' k, false ligada from leads
                union all select g.uf, g.receita, 'g', false from clientes_crm g
                union all select c.uf, 0, 'a', c.ligada from carteira c) d
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
