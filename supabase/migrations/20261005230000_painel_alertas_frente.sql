-- Painel de Controle: alertas dos blocos "pra frente" e limpeza de alerta repetido (05/10/2026).
--
-- - Caixa: alerta médio com o total das contas a pagar vencidas há mais de 30
--   dias. Elas ficam fora da projeção por padrão; o alerta é pra dar baixa no que
--   é lixo de cadastro e pôr data no que é dívida.
-- - Antecedentes: cobertura do pipeline abaixo de 1x (alta); semana que vem com
--   menos da metade da média semanal de reuniões (média); mais de 10 leads novos
--   sem dono (média).
-- - A lista de alertas sai ordenada: altos primeiro, depois médios e baixos.
-- - Quando "Caixa fica negativo..." está ativo, "Saldo em banco abaixo das contas
--   da semana" não aparece: os dois diziam quase a mesma coisa.

-- "R$ 140 mil" / "R$ 1,2 mi" / "R$ 8.450": dinheiro curto pros títulos de alerta
create or replace function public.painel_brl_curto(v numeric)
returns text
language sql
immutable
set search_path = public
as $$
  select case when v is null then '-'
    when abs(v) >= 1000000 then case when v < 0 then '-' else '' end || 'R$ ' || replace(round(abs(v) / 1000000, 1)::text, '.', ',') || ' mi'
    when abs(v) >= 10000 then case when v < 0 then '-' else '' end || 'R$ ' || round(abs(v) / 1000)::text || ' mil'
    else painel_brl(v) end;
$$;

create or replace function public.painel_caixa_interno()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  saldo numeric; n_bancos int;
  tx jsonb; res jsonb; cen jsonb;
  neg_r date; pior_r numeric; pior_r_d date; em30_r numeric;
  alertas jsonb := '[]'::jsonb;
  m_ini date := (date_trunc('month', hoje) - interval '3 months')::date;  -- três meses fechados
  m_fim date := date_trunc('month', hoje)::date;
begin
  select coalesce(sum(b.current_balance_cents) / 100.0, 0), count(*) into saldo, n_bancos
    from financial_banks b where b.is_active and b.tenant_id is null;
  tx := painel_caixa_taxas();

  with it as materialized (select * from painel_caixa_itens()),
  dias as (select g::date d from generate_series(hoje, hoje + 90, interval '1 day') g),
  ec as (select data_c d, sum(valor_c) v, count(*) n from it where tipo = 'entrada' and valor_c is not null group by 1),
  er as (select data_r d, sum(valor_r) v, count(*) n from it where tipo = 'entrada' and valor_r is not null group by 1),
  sd as (select data_c d, sum(valor_c) v, count(*) n from it where tipo = 'saida' and valor_c is not null group by 1),
  mov as (
    select d.d, coalesce(ec.v, 0) ec, coalesce(er.v, 0) er, coalesce(sd.v, 0) s,
           coalesce(ec.n, 0) n_ec, coalesce(er.n, 0) n_er, coalesce(sd.n, 0) n_s
      from dias d left join ec on ec.d = d.d left join er on er.d = d.d left join sd on sd.d = d.d
  ),
  acc as (
    select m.*, saldo + sum(ec - s) over (order by d) sc, saldo + sum(er - s) over (order by d) sr from mov m
  ),
  sem as (
    select (d - hoje) / 7 + 1 n, min(d) de, max(d) ate, sum(ec) ec, sum(er) er, sum(s) s,
           (array_agg(sc order by d desc))[1] sc, (array_agg(sr order by d desc))[1] sr,
           min(sc) min_c, min(sr) min_r, sum(n_ec) n_ec, sum(n_er) n_er, sum(n_s) n_s
      from acc group by 1
  ),
  resumo as (
    select
      (select jsonb_build_object(
          'em30', (select sc from acc where d = hoje + 30), 'em60', (select sc from acc where d = hoje + 60), 'em90', (select sc from acc where d = hoje + 90),
          'primeiro_negativo', (select min(d) from acc where sc < 0),
          'pior_valor', (select sc from acc order by sc, d limit 1), 'pior_data', (select d from acc order by sc, d limit 1),
          'entra', (select sum(ec) from acc), 'sai', (select sum(s) from acc))) contratado,
      (select jsonb_build_object(
          'em30', (select sr from acc where d = hoje + 30), 'em60', (select sr from acc where d = hoje + 60), 'em90', (select sr from acc where d = hoje + 90),
          'primeiro_negativo', (select min(d) from acc where sr < 0),
          'pior_valor', (select sr from acc order by sr, d limit 1), 'pior_data', (select d from acc order by sr, d limit 1),
          'entra', (select sum(er) from acc), 'sai', (select sum(s) from acc))) realista
  )
  select jsonb_build_object(
    'hoje', hoje, 'saldo_inicial', saldo, 'bancos_n', n_bancos, 'taxas', tx,
    -- contexto: a projeção só enxerga o que já está lançado. O que entrou e saiu de
    -- verdade por mês, nos três meses fechados, mostra o tamanho do que falta lançar.
    'historico', jsonb_build_object('de', m_ini, 'ate', m_fim - 1,
      'recebido_mes', (select round(coalesce(sum(coalesce(i.paid_amount_cents, i.amount_cents)), 0) / 100.0 / 3, 2) from company_invoices i
                        where i.status = 'paid' and i.paid_at >= m_ini::timestamp at time zone 'America/Sao_Paulo' and i.paid_at < m_fim::timestamp at time zone 'America/Sao_Paulo'),
      'pago_mes', (select round(coalesce(sum(coalesce(y.paid_amount, y.amount)), 0) / 3, 2) from financial_payables y
                    where y.status = 'paid' and y.tenant_id is null and y.paid_date >= m_ini and y.paid_date < m_fim),
      'faturado_30d', (select coalesce(sum(valor_c), 0) from it where tipo = 'entrada' and data_c <= hoje + 30),
      'a_pagar_30d', (select coalesce(sum(valor_c), 0) from it where tipo = 'saida' and data_c <= hoje + 30)),
    'cenarios', jsonb_build_object('contratado', r.contratado, 'realista', r.realista),
    'semanas', (select jsonb_agg(jsonb_build_object('n', s.n, 'de', s.de, 'ate', s.ate, 'entra_c', s.ec, 'entra_r', s.er, 'sai', s.s,
                  'saldo_c', s.sc, 'saldo_r', s.sr, 'min_c', s.min_c, 'min_r', s.min_r, 'n_entradas', s.n_ec, 'n_entradas_r', s.n_er, 'n_saidas', s.n_s) order by s.n) from sem s),
    'dias', (select jsonb_agg(jsonb_build_object('d', a.d, 'c', round(a.sc, 2), 'r', round(a.sr, 2)) order by a.d) from acc a),
    'fora', jsonb_build_object(
      'pagar_antigas', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(valor), 0)) from it where tipo = 'saida' and classe = 'vencida_antiga'),
      'receber_antigas', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(valor), 0)) from it where tipo = 'entrada' and classe = 'vencida_antiga'),
      'pagar_recentes', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(valor), 0)) from it where tipo = 'saida' and classe = 'vencida_recente'),
      'receber_recentes', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(valor), 0)) from it where tipo = 'entrada' and classe = 'vencida_recente'),
      'fora_do_realista', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(valor), 0)) from it where tipo = 'entrada' and valor_c is not null and valor_r is null),
      'renovacoes', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(valor), 0)) from it where origem = 'renovacao'),
      'recebiveis_legado', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(fr.amount - coalesce(fr.paid_amount, 0)), 0))
                              from financial_receivables fr where fr.tenant_id is null and fr.status in ('pending','overdue','partial')))
  ) into res
  from resumo r;

  cen := res #> '{cenarios,realista}';
  neg_r := (cen->>'primeiro_negativo')::date;
  pior_r := (cen->>'pior_valor')::numeric; pior_r_d := (cen->>'pior_data')::date; em30_r := (cen->>'em30')::numeric;

  if neg_r is not null and neg_r <= hoje + 30 then
    alertas := alertas || jsonb_build_object('area', 'financeiro', 'gravidade', 'alta',
      'titulo', case when neg_r = hoje then 'Caixa fica negativo hoje no cenário realista'
                     else 'Caixa fica negativo em ' || to_char(neg_r, 'DD/MM') || ' no cenário realista' end,
      'detalhe', 'Saldo de ' || painel_brl(saldo) || ' hoje. Pior ponto: ' || painel_brl(pior_r) || ' em ' || to_char(pior_r_d, 'DD/MM')
                 || '. Em 30 dias: ' || painel_brl(em30_r) || '. Sem contar venda nova.',
      'link', '/onboarding-tasks/financeiro', 'view', 'caixa');
  end if;

  -- contas a pagar vencidas há mais de 30 dias ficam fora da projeção; o alerta é
  -- pra limpar o que for lixo de cadastro e encarar o que é dívida de verdade
  if (res #>> '{fora,pagar_antigas,n}')::int > 0 and (res #>> '{fora,pagar_antigas,valor}')::numeric >= 1000 then
    alertas := alertas || jsonb_build_object('area', 'financeiro', 'gravidade', 'media',
      'titulo', painel_brl_curto((res #>> '{fora,pagar_antigas,valor}')::numeric) || ' em contas vencidas há mais de 30 dias: pagar, renegociar ou baixar',
      'detalhe', (res #>> '{fora,pagar_antigas,n}') || ' contas em aberto no Contas a Pagar, fora da projeção de caixa. O que não é mais devido precisa de baixa ou exclusão; o que é dívida precisa de data.',
      'link', '/onboarding-tasks/financeiro', 'view', 'caixa');
  end if;

  return res || jsonb_build_object('alertas', alertas);
end $$;

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
  alertas jsonb := '[]'::jsonb;
  media_sem numeric; sem_que_vem int; sem_dono int;
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

  ------------------------------------------------------------------ alertas
  if v_meta is not null and vendido < v_meta and cob is not null and cob < 1 then
    alertas := alertas || jsonb_build_object('area', 'comercial', 'gravidade', 'alta',
      'titulo', 'Cobertura do pipeline em ' || replace(round(cob, 1)::text, '.', ',') || 'x: faltam ' || painel_brl_curto(falta) || ' e o pipeline ponderado é ' || painel_brl_curto(pond),
      'detalhe', 'Meta de vendas do mês ' || painel_brl(v_meta) || ', vendido ' || painel_brl(vendido) || '. O pipeline de hoje não fecha a meta: precisa de lead novo e reunião marcada.',
      'link', '/crm/pipeline', 'view', 'antecedentes');
  end if;
  media_sem := (reun->>'media_semanal')::numeric;
  sem_que_vem := (reun->>'prox14')::int - (reun->>'prox7')::int;
  if media_sem >= 2 and sem_que_vem < media_sem / 2 then
    alertas := alertas || jsonb_build_object('area', 'comercial', 'gravidade', 'media',
      'titulo', case when sem_que_vem = 0 then 'Semana que vem sem reunião agendada'
                     else 'Semana que vem com só ' || sem_que_vem || ' reuni' || case when sem_que_vem = 1 then 'ão agendada' else 'ões agendadas' end end,
      'detalhe', 'A média das últimas 4 semanas é ' || replace(media_sem::text, '.', ',') || ' por semana. Agenda vazia hoje é venda faltando daqui a duas semanas.',
      'link', '/crm/meetings', 'view', 'antecedentes');
  end if;
  sem_dono := (leads->>'sem_dono')::int;
  if sem_dono > 10 then
    alertas := alertas || jsonb_build_object('area', 'comercial', 'gravidade', 'media',
      'titulo', sem_dono || ' leads novos sem dono',
      'detalhe', 'Criados nos últimos 14 dias nos funis que contam entrada, ainda abertos e sem responsável. Lead sem dono não recebe o primeiro contato.',
      'link', '/crm/leads', 'view', 'antecedentes');
  end if;

  return jsonb_build_object('hoje', hoje, 'reunioes', reun, 'pipeline', pipe, 'leads', leads, 'alertas', alertas);
end $$;

create or replace function public.painel_controle_interno(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    'mrr', (select coalesce(sum(c.amount_cents)/100.0,0) from company_recurring_charges c where c.is_active and c.recurrence = 'monthly'),
    'mrr_n', (select count(*) from company_recurring_charges c where c.is_active and c.recurrence = 'monthly'),
    'mrr_em_aviso', (select coalesce(sum(c.amount_cents)/100.0,0) from company_recurring_charges c
                      join onboarding_projects p on p.onboarding_company_id = c.company_id
                     where c.is_active and c.recurrence = 'monthly' and p.status in ('notice_period','cancellation_signaled')),
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
          from financial_payables p left join financial_categories fc on fc.id = p.category_id
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
                 'mensalidades', (select coalesce(sum(c.amount_cents)/100.0,0) from company_recurring_charges c join emp e on e.id = c.company_id where e.consultant_id = s.id and c.is_active and c.recurrence = 'monthly')) x
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
      from crm_whatsapp_messages m where m.created_at >= t_ini and m.created_at < t_fim and m.deleted_at is null
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
end $$;

revoke all on function public.painel_brl_curto(numeric) from public, anon;
grant execute on function public.painel_brl_curto(numeric) to authenticated, service_role;
revoke all on function public.painel_caixa_interno() from public, anon, authenticated;
grant execute on function public.painel_caixa_interno() to service_role;
revoke all on function public.painel_antecedentes_interno() from public, anon, authenticated;
grant execute on function public.painel_antecedentes_interno() to service_role;
revoke all on function public.painel_controle_interno(date) from public, anon, authenticated;
grant execute on function public.painel_controle_interno(date) to service_role;
