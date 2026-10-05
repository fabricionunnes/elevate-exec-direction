-- Painel de Controle: indicadores antecedentes, "o que ainda dá pra mudar" (05/10/2026).
--
-- Reuniões na agenda: crm_activities tipo meeting, não cancelada, pela data
-- marcada (scheduled_at, Brasília). Próximos 7 e 14 dias contando hoje, por dia e
-- por closer, contra a média semanal das últimas 4 semanas (28 dias antes de hoje).
-- crm_meeting_events não serve aqui: guarda quando o evento foi registrado, não a
-- data da reunião.
--
-- Pipeline aberto: lead fora de etapa final, com valor, e com movimento nos
-- últimos 90 dias (entrada na etapa ou última atividade). O que está parado há
-- mais tempo fica separado: são funis antigos importados, não é pipeline.
-- Valor ponderado = valor x probabilidade da etapa. A probabilidade é a conversão
-- histórica: dos leads que ENTRARAM naquela etapa nos últimos 180 dias
-- (crm_lead_history, que guarda o nome da etapa), quantos estão ganhos hoje.
-- Usa a taxa da etapa no próprio funil quando há 15 entradas ou mais; senão, a da
-- etapa com o mesmo nome em todos os funis; senão 5% fixo. A fonte usada vai junto.
-- crm_leads.probability não serve: está vazio em todos os leads.
--
-- Cobertura = ponderado / (meta de vendas do mês corrente - já vendido no mês).
-- Meta = crm_goal_values do tipo "Vendas" de staff ativo que não é head.
-- Leitura: abaixo de 1x vermelho, de 1 a 3x âmbar, acima de 3x verde.
--
-- Leads: criados nos últimos 7 dias contra a média semanal das 4 semanas
-- anteriores, nos funis que contam entrada. Sem dono e sem primeira atividade:
-- leads desses funis criados nos últimos 14 dias e ainda abertos. "Sem atividade"
-- = sem atividade registrada, sem mudança de etapa feita por pessoa e sem
-- mensagem enviada na conversa ligada ao lead.

-- Meta de vendas do mês (também usada no bloco de ritmo da meta).
create or replace function public.painel_meta_mes_interno(p_month date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with m as (select date_trunc('month', coalesce(p_month, (now() at time zone 'America/Sao_Paulo')::date))::date d),
  metas as (
    select s.id, s.name, s.role, g.meta_value, g.super_meta_value, g.hiper_meta_value
      from crm_goal_values g join crm_goal_types t on t.id = g.goal_type_id join onboarding_staff s on s.id = g.staff_id, m
     where t.name = 'Vendas' and t.unit_type = 'currency' and g.month = extract(month from m.d)::int and g.year = extract(year from m.d)::int
       and s.is_active and s.tenant_id is null and s.role <> 'head_comercial' and coalesce(g.meta_value, 0) > 0
  ),
  -- quem vende: papel closer ou marcado como closer do CRM
  time_vendas as (
    select s.id, s.name, s.role from onboarding_staff s
     where s.is_active and s.tenant_id is null and s.role <> 'head_comercial' and (s.role = 'closer' or coalesce(s.is_crm_closer, false))
  )
  select jsonb_build_object(
    'mes', (select d from m),
    'meta', (select sum(meta_value) from metas),
    'super_meta', (select sum(super_meta_value) from metas),
    'com_meta', (select coalesce(jsonb_agg(jsonb_build_object('staff_id', id, 'nome', name, 'papel', role, 'meta', meta_value, 'super_meta', super_meta_value) order by meta_value desc), '[]') from metas),
    'sem_meta', (select coalesce(jsonb_agg(jsonb_build_object('staff_id', t.id, 'nome', t.name, 'papel', t.role) order by t.name), '[]') from time_vendas t where not exists (select 1 from metas x where x.id = t.id)));
$$;

create or replace function public.painel_antecedentes_interno()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  m_ini date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
  t0 timestamptz := (now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo';  -- zero hora de hoje
  reun jsonb; pipe jsonb; leads jsonb; meta jsonb;
  vendido numeric; v_meta numeric; falta numeric; pond numeric; cob numeric;
begin
  ------------------------------------------------------------------ reuniões na agenda
  with ag as (
    select (a.scheduled_at at time zone v_tz)::date dia, a.responsible_staff_id sid, coalesce(s.name, 'Sem responsável') nome
      from crm_activities a left join onboarding_staff s on s.id = a.responsible_staff_id
     where a.type = 'meeting' and a.status <> 'cancelled'
       and a.scheduled_at >= t0 - interval '28 days' and a.scheduled_at < t0 + interval '14 days'
  ),
  dias as (select g::date d from generate_series(hoje, hoje + 13, interval '1 day') g)
  select jsonb_build_object(
    'prox7', (select count(*) from ag where dia between hoje and hoje + 6),
    'prox14', (select count(*) from ag where dia between hoje and hoje + 13),
    'hoje', (select count(*) from ag where dia = hoje),
    'ultimos28', (select count(*) from ag where dia < hoje),
    'media_semanal', (select round(count(*) / 4.0, 1) from ag where dia < hoje),
    'semanas_passadas', (select jsonb_agg(jsonb_build_object('de', hoje - 7 * k, 'ate', hoje - 7 * k + 6, 'n', (select count(*) from ag where dia between hoje - 7 * k and hoje - 7 * k + 6)) order by k desc) from generate_series(1, 4) k),
    'por_dia', (select jsonb_agg(jsonb_build_object('dia', d.d, 'n', (select count(*) from ag where dia = d.d),
                  'por', (select coalesce(jsonb_agg(jsonb_build_object('nome', x.nome, 'n', x.n) order by x.n desc), '[]') from (select nome, count(*) n from ag where dia = d.d group by nome) x)) order by d.d) from dias d),
    'por_closer', (select coalesce(jsonb_agg(jsonb_build_object('staff_id', x.sid, 'nome', x.nome, 'prox7', x.p7, 'prox14', x.p14, 'ultimos28', x.u28) order by x.p14 desc, x.u28 desc), '[]')
                     from (select sid, nome, count(*) filter (where dia between hoje and hoje + 6) p7, count(*) filter (where dia between hoje and hoje + 13) p14, count(*) filter (where dia < hoje) u28 from ag group by sid, nome) x)
  ) into reun;

  ------------------------------------------------------------------ pipeline aberto e ponderado
  with ent as (
    select distinct h.lead_id, l.pipeline_id, h.new_value etapa
      from crm_lead_history h join crm_leads l on l.id = h.lead_id
     where h.action = 'stage_change' and h.created_at >= now() - interval '180 days' and l.tenant_id is null
  ),
  cf as (
    select e.pipeline_id, e.etapa, count(*) n, count(*) filter (where s.final_type = 'won') g
      from ent e join crm_leads l on l.id = e.lead_id join crm_stages s on s.id = l.stage_id group by 1, 2
  ),
  cg as (select etapa, sum(n) n, sum(g) g from cf group by 1),
  ab as (
    select l.stage_id, count(*) n, sum(l.opportunity_value) v
      from crm_leads l join crm_stages st on st.id = l.stage_id
     where l.tenant_id is null and not st.is_final and l.opportunity_value > 0
       and greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)) >= now() - interval '90 days'
     group by 1
  ),
  et as (
    select st.id stage_id, p.name funil, st.name etapa, st.sort_order ordem, ab.n, ab.v,
           case when coalesce(cf.n, 0) >= 15 then 'funil' when coalesce(cg.n, 0) >= 15 then 'geral' else 'fixa' end fonte,
           case when coalesce(cf.n, 0) >= 15 then cf.n when coalesce(cg.n, 0) >= 15 then cg.n end amostra_n,
           case when coalesce(cf.n, 0) >= 15 then cf.g when coalesce(cg.n, 0) >= 15 then cg.g end amostra_g,
           case when coalesce(cf.n, 0) >= 15 then round(cf.g::numeric / cf.n, 4) when coalesce(cg.n, 0) >= 15 then round(cg.g::numeric / cg.n, 4) else 0.05 end prob
      from ab join crm_stages st on st.id = ab.stage_id join crm_pipelines p on p.id = st.pipeline_id
      left join cf on cf.pipeline_id = st.pipeline_id and cf.etapa = st.name
      left join cg on cg.etapa = st.name
  )
  select jsonb_build_object(
    'aberto_valor', (select coalesce(sum(v), 0) from et), 'aberto_n', (select coalesce(sum(n), 0) from et),
    'ponderado', (select coalesce(round(sum(v * prob), 2), 0) from et),
    'parado', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(l.opportunity_value), 0))
                 from crm_leads l join crm_stages st on st.id = l.stage_id
                where l.tenant_id is null and not st.is_final and l.opportunity_value > 0 and greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)) < now() - interval '90 days'),
    'etapas', (select coalesce(jsonb_agg(jsonb_build_object('stage_id', stage_id, 'funil', funil, 'etapa', etapa, 'ordem', ordem, 'n', n, 'valor', v,
                 'prob', prob, 'fonte', fonte, 'amostra_n', amostra_n, 'amostra_ganhos', amostra_g, 'ponderado', round(v * prob, 2)) order by v * prob desc, v desc), '[]') from et)
  ) into pipe;

  meta := painel_meta_mes_interno(m_ini);
  select coalesce(sum(l.opportunity_value), 0) into vendido
    from crm_leads l join crm_stages st on st.id = l.stage_id
   where st.final_type = 'won' and l.tenant_id is null and l.closed_at >= m_ini::timestamp at time zone v_tz;
  v_meta := (meta->>'meta')::numeric;
  pond := (pipe->>'ponderado')::numeric;
  falta := case when v_meta is not null then greatest(v_meta - vendido, 0) end;
  cob := case when falta is not null and falta > 0 then round(pond / falta, 2) end;
  pipe := pipe || jsonb_build_object(
    'meta', meta, 'vendido', vendido, 'falta', falta, 'cobertura', cob,
    'meta_batida', (v_meta is not null and vendido >= v_meta),
    'nivel', case when v_meta is null then null when vendido >= v_meta then 'verde' when cob is null then null when cob < 1 then 'vermelho' when cob <= 3 then 'ambar' else 'verde' end);

  ------------------------------------------------------------------ leads novos e sem cuidado
  with ld as (
    select l.id, (l.created_at at time zone v_tz)::date dia, l.owner_staff_id, st.is_final,
           (not exists (select 1 from crm_activities a where a.lead_id = l.id)
            and not exists (select 1 from crm_lead_history h where h.lead_id = l.id and h.action = 'stage_change' and h.staff_id is not null)
            and not exists (select 1 from crm_whatsapp_conversations c where c.lead_id = l.id and c.last_message_at is not null and (c.last_message_direction = 'outbound' or c.last_inbound_at is distinct from c.last_message_at))) sem_ativ
      from crm_leads l join crm_pipelines p on p.id = l.pipeline_id join crm_stages st on st.id = l.stage_id
     where l.tenant_id is null and p.counts_lead_inflow and l.created_at >= t0 - interval '13 days'
  ),
  hist as (
    select (l.created_at at time zone v_tz)::date dia, coalesce(p.counts_lead_inflow, false) conta
      from crm_leads l left join crm_pipelines p on p.id = l.pipeline_id
     where l.tenant_id is null and l.created_at >= t0 - interval '34 days'
  )
  select jsonb_build_object(
    'novos7', (select count(*) from hist where conta and dia >= hoje - 6),
    'novos7_total', (select count(*) from hist where dia >= hoje - 6),
    'media4', (select round(count(*) / 4.0, 1) from hist where conta and dia between hoje - 34 and hoje - 7),
    'media4_total', (select round(count(*) / 4.0, 1) from hist where dia between hoje - 34 and hoje - 7),
    'semanas', (select jsonb_agg(jsonb_build_object('de', hoje - 6 - 7 * k, 'ate', hoje - 7 * k, 'n', (select count(*) from hist where conta and dia between hoje - 6 - 7 * k and hoje - 7 * k)) order by k desc) from generate_series(0, 4) k),
    'abertos_14d', (select count(*) from ld where not is_final),
    'sem_dono', (select count(*) from ld where not is_final and owner_staff_id is null),
    'sem_atividade', (select count(*) from ld where not is_final and sem_ativ)
  ) into leads;

  return jsonb_build_object('hoje', hoje, 'reunioes', reun, 'pipeline', pipe, 'leads', leads, 'alertas', '[]'::jsonb);
end $$;

create or replace function public.painel_frente_interno(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare caixa jsonb; fund jsonb; ant jsonb;
begin
  caixa := painel_caixa_interno();
  fund := painel_fundador_interno(p_month);
  ant := painel_antecedentes_interno();
  return jsonb_build_object(
    'caixa', caixa - 'alertas',
    'fundador', fund->'fundador',
    'concentracao', fund->'concentracao',
    'antecedentes', ant - 'alertas',
    'alertas', coalesce(caixa->'alertas', '[]'::jsonb) || coalesce(fund->'alertas', '[]'::jsonb) || coalesce(ant->'alertas', '[]'::jsonb));
end $$;

-- Listas de detalhe dos blocos "pra frente":
--   caixa_movimentos  {de, ate, tipo: entrada|saida, classe}
--   vendas_grupo      {grupo: fundador|time|sem_fechador}
--   mrr_clientes      {grupo: base|fora}
--   reunioes_futuras  {de, ate, staff_id}
--   pipeline_aberto   {grupo: vivo|parado, stage_id}
--   leads_atencao     {tipo: novos7|sem_dono|sem_atividade}
create or replace function public.painel_frente_detalhe(p_month date, p_bloco text, p_filtro jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f_de date := nullif(p_filtro->>'de', '')::date;
  f_ate date := nullif(p_filtro->>'ate', '')::date;
  f_tipo text := nullif(p_filtro->>'tipo', '');
  f_classe text := nullif(p_filtro->>'classe', '');
  f_grupo text := nullif(p_filtro->>'grupo', '');
  f_staff uuid := nullif(p_filtro->>'staff_id', '')::uuid;
  f_stage uuid := nullif(p_filtro->>'stage_id', '')::uuid;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := date_trunc('month', coalesce(p_month, (now() at time zone 'America/Sao_Paulo')::date))::date;
  t_ini timestamptz; t_fim timestamptz;
  saida jsonb;
begin
  if not is_master() then raise exception 'Só o master'; end if;
  t_ini := v_ini::timestamp at time zone 'America/Sao_Paulo';
  t_fim := (v_ini + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';

  case p_bloco

  when 'caixa_movimentos' then
    with base as (
      select i.tipo, i.origem, i.ref_id, i.company_id, i.nome, i.descricao, i.vencimento, i.valor, i.classe, i.dias_atraso,
             i.data_c, i.valor_c, i.data_r, i.valor_r, i.motivo_r
        from painel_caixa_itens() i
       where (f_tipo is null or i.tipo = f_tipo) and (f_classe is null or i.classe = f_classe)
         and (f_de is null or (i.data_c between f_de and coalesce(f_ate, f_de)) or (i.data_r between f_de and coalesce(f_ate, f_de)))
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      -- com janela, cada soma só conta o que cai na janela naquele cenário (bate com a linha da semana)
      'entra_c', (select coalesce(sum(valor_c), 0) from base where tipo = 'entrada' and (f_de is null or data_c between f_de and coalesce(f_ate, f_de))),
      'entra_r', (select coalesce(sum(valor_r), 0) from base where tipo = 'entrada' and (f_de is null or data_r between f_de and coalesce(f_ate, f_de))),
      'sai', (select coalesce(sum(valor_c), 0) from base where tipo = 'saida' and (f_de is null or data_c between f_de and coalesce(f_ate, f_de))),
      -- o que está na lista mas não entra em nenhum cenário (vencido há mais de 30 dias)
      'fora_valor', (select coalesce(sum(valor), 0) from base where valor_c is null and valor_r is null),
      'fora_n', (select count(*) from base where valor_c is null and valor_r is null),
      'soma', (select coalesce(sum(valor), 0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.tipo, coalesce(b.data_c, b.data_r, b.vencimento), b.valor desc), '[]')
                   from (select * from base order by tipo, coalesce(data_c, data_r, vencimento), valor desc limit 500) b)) into saida;

  when 'vendas_grupo' then
    -- vendas do mês por quem fechou: fundador, time ou sem fechador (venda do site)
    with fab as (select s.id from onboarding_staff s where s.role = 'master' and s.tenant_id is null and s.is_active order by s.created_at limit 1),
    base as (
      select l.id lead_id, l.name nome, l.company empresa, l.opportunity_value valor, (l.closed_at at time zone 'America/Sao_Paulo')::date data,
             cs.name closer, sd.name sdr, p.name funil, coalesce(l.origin, l.utm_source, case when l.meta_campaign_id is not null then 'Meta Ads' end) origem,
             case when coalesce(l.closer_staff_id, l.owner_staff_id) is null then 'sem_fechador'
                  when coalesce(l.closer_staff_id, l.owner_staff_id) = (select id from fab) then 'fundador' else 'time' end grupo,
             (select string_agg(s.product_name, ', ') from crm_sales s where s.lead_id = l.id) produto
        from crm_leads l join crm_stages st on st.id = l.stage_id
        left join onboarding_staff cs on cs.id = coalesce(l.closer_staff_id, l.owner_staff_id) left join onboarding_staff sd on sd.id = l.sdr_staff_id
        left join crm_pipelines p on p.id = l.pipeline_id
       where st.final_type = 'won' and l.tenant_id is null and l.closed_at >= t_ini and l.closed_at < t_fim
    )
    select jsonb_build_object('total', (select count(*) from base where f_grupo is null or grupo = f_grupo),
      'soma', (select coalesce(sum(valor), 0) from base where f_grupo is null or grupo = f_grupo),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.data desc, b.valor desc), '[]')
                   from (select * from base where f_grupo is null or grupo = f_grupo order by data desc limit 500) b)) into saida;

  when 'mrr_clientes' then
    -- mensalidade por cliente. base = cobrança ativa, de empresa ativa, com fatura a vencer.
    -- fora = cobrança marcada como ativa que não está mais faturando.
    with cob as (
      select r.id, r.company_id, r.amount_cents / 100.0 valor, r.description, r.installments,
             (select max(i.due_date) from company_invoices i where i.recurring_charge_id = r.id) ult,
             exists (select 1 from company_invoices i where i.recurring_charge_id = r.id and i.paid_at is null and i.due_date >= hoje) fut
        from company_recurring_charges r where r.is_active and r.recurrence = 'monthly'
    ),
    cli as (
      select c.id company_id, c.name empresa, c.status empresa_status, st.name consultor, c.contract_end_date contrato_fim, c.renewal_plan_type plano,
             sum(k.valor) valor, count(*) cobrancas, max(k.ult) parcelas_ate, string_agg(k.description, ' + ') descricao,
             case when c.status <> 'active' then 'empresa inativa' when not bool_or(k.fut) then 'sem fatura a vencer (cobrança avulsa ou plano encerrado)' end motivo_fora,
             (c.status = 'active') na_base_emp
        from cob k join onboarding_companies c on c.id = k.company_id left join onboarding_staff st on st.id = c.consultant_id
       where (coalesce(f_grupo, 'base') = 'base' and c.status = 'active' and k.fut) or (f_grupo = 'fora' and not (c.status = 'active' and k.fut))
       group by c.id, c.name, c.status, st.name, c.contract_end_date, c.renewal_plan_type
    ),
    tot as (select coalesce(sum(valor), 0) t from cli)
    select jsonb_build_object('total', (select count(*) from cli), 'soma', (select t from tot),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.valor desc), '[]')
                   from (select c.*, case when (select t from tot) > 0 then round(c.valor / (select t from tot), 4) end pct from cli c order by c.valor desc limit 500) b)) into saida;

  when 'reunioes_futuras' then
    -- reuniões na agenda (atividade tipo reunião, não cancelada) numa janela de datas
    with base as (
      select a.id, a.lead_id, l.name nome, l.company empresa, (a.scheduled_at at time zone 'America/Sao_Paulo')::date dia,
             to_char(a.scheduled_at at time zone 'America/Sao_Paulo', 'HH24:MI') hora, a.scheduled_at quando, s.name closer, a.status, a.title titulo,
             p.name funil, st.name etapa, l.opportunity_value valor, sd.name sdr, a.responsible_staff_id
        from crm_activities a left join crm_leads l on l.id = a.lead_id left join onboarding_staff s on s.id = a.responsible_staff_id
        left join crm_pipelines p on p.id = l.pipeline_id left join crm_stages st on st.id = l.stage_id left join onboarding_staff sd on sd.id = l.sdr_staff_id
       where a.type = 'meeting' and a.status <> 'cancelled'
         and (a.scheduled_at at time zone 'America/Sao_Paulo')::date between coalesce(f_de, hoje) and coalesce(f_ate, hoje + 13)
         and (f_staff is null or a.responsible_staff_id = f_staff)
    )
    select jsonb_build_object('total', (select count(*) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.quando), '[]') from (select * from base order by quando limit 500) b)) into saida;

  when 'pipeline_aberto' then
    -- leads abertos com valor. grupo vivo = movimento nos últimos 90 dias; parado = o resto
    with base as (
      select l.id lead_id, l.name nome, l.company empresa, l.opportunity_value valor, p.name funil, st.name etapa, st.id stage_id, ow.name dono,
             (greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)))::date ultimo_movimento, hoje - (greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)))::date dias_parado, (l.created_at at time zone 'America/Sao_Paulo')::date criado_em,
             coalesce(l.origin, l.utm_source) origem
        from crm_leads l join crm_stages st on st.id = l.stage_id left join crm_pipelines p on p.id = l.pipeline_id left join onboarding_staff ow on ow.id = l.owner_staff_id
       where l.tenant_id is null and not st.is_final and l.opportunity_value > 0
         and (f_stage is null or l.stage_id = f_stage)
         and ((coalesce(f_grupo, 'vivo') = 'vivo' and greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)) >= now() - interval '90 days') or (f_grupo = 'parado' and greatest(coalesce(l.stage_entered_at, l.created_at), coalesce(l.last_activity_at, l.created_at)) < now() - interval '90 days'))
    )
    select jsonb_build_object('total', (select count(*) from base), 'soma', (select coalesce(sum(valor), 0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.valor desc), '[]') from (select * from base order by valor desc limit 500) b)) into saida;

  when 'leads_atencao' then
    -- leads recentes dos funis que contam: novos7 (últimos 7 dias), sem_dono, sem_atividade (últimos 14 dias, ainda abertos)
    with base as (
      select l.id lead_id, l.name nome, l.company empresa, p.name funil, st.name etapa, ow.name dono, (l.created_at at time zone 'America/Sao_Paulo')::date criado_em,
             hoje - (l.created_at at time zone 'America/Sao_Paulo')::date dias, coalesce(l.origin, l.utm_source, case when l.meta_campaign_id is not null then 'Meta Ads' end) origem, l.phone telefone,
             (l.owner_staff_id is null) sem_dono,
             (not exists (select 1 from crm_activities a where a.lead_id = l.id)
              and not exists (select 1 from crm_lead_history h where h.lead_id = l.id and h.action = 'stage_change' and h.staff_id is not null)
              and not exists (select 1 from crm_whatsapp_conversations c where c.lead_id = l.id and c.last_message_at is not null and (c.last_message_direction = 'outbound' or c.last_inbound_at is distinct from c.last_message_at))) sem_atividade,
             st.is_final
        from crm_leads l join crm_pipelines p on p.id = l.pipeline_id join crm_stages st on st.id = l.stage_id left join onboarding_staff ow on ow.id = l.owner_staff_id
       where l.tenant_id is null and p.counts_lead_inflow and l.created_at >= (hoje - 13)::timestamp at time zone 'America/Sao_Paulo'
    ),
    f as (
      select * from base where case coalesce(f_tipo, 'novos7')
        when 'novos7' then criado_em >= hoje - 6
        when 'sem_dono' then sem_dono and not is_final
        when 'sem_atividade' then sem_atividade and not is_final
        else true end
    )
    select jsonb_build_object('total', (select count(*) from f),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.criado_em desc), '[]') from (select * from f order by criado_em desc limit 500) b)) into saida;

  else
    raise exception 'Bloco desconhecido: %', p_bloco;
  end case;

  return saida || jsonb_build_object('bloco', p_bloco, 'mes', to_char(v_ini, 'YYYY-MM-DD'), 'limite', 500);
end $$;

revoke all on function public.painel_meta_mes_interno(date) from public, anon, authenticated;
grant execute on function public.painel_meta_mes_interno(date) to service_role;
revoke all on function public.painel_antecedentes_interno() from public, anon, authenticated;
grant execute on function public.painel_antecedentes_interno() to service_role;
revoke all on function public.painel_frente_interno(date) from public, anon, authenticated;
grant execute on function public.painel_frente_interno(date) to service_role;
revoke all on function public.painel_frente_detalhe(date, text, jsonb) from public, anon;
grant execute on function public.painel_frente_detalhe(date, text, jsonb) to authenticated;
