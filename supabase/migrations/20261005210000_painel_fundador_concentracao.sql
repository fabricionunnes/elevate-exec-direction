-- Painel de Controle: dependência do fundador e concentração da carteira (05/10/2026).
--
-- Dependência do fundador: quanto da receita nova e das vendas do mês foi fechado
-- pelo próprio dono. "Quem fechou" = closer_staff_id do lead ganho e, se vazio, o
-- dono do lead (owner_staff_id). Venda sem nenhum dos dois (checkout do site) fica
-- num grupo à parte, "sem fechador", e conta no total. O fundador é o staff master
-- da UNV. Reunião realizada "por ele" = evento realized cujo dono do lead é ele
-- (owner_staff_id; se vazio, quem foi creditado). Referência: abaixo de 30% verde,
-- de 30 a 60% âmbar, acima vermelho.
--
-- Concentração: mensalidade por cliente. A base é a cobrança recorrente ativa, de
-- empresa ativa e com fatura a vencer. Cobrança marcada como ativa que não fatura
-- mais (avulsa de parcela única, plano encerrado, empresa inativa) fica de fora e
-- o valor aparece separado, porque o MRR do topo do painel ainda conta essas.
-- Alerta quando um cliente passa de 15% ou os cinco maiores passam de 50%.

create or replace function public.painel_fundador_interno(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := date_trunc('month', coalesce(p_month, (now() at time zone 'America/Sao_Paulo')::date))::date;
  s_fim date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date) + interval '1 month')::date;
  s_ini date; ts_ini timestamptz; ts_fim timestamptz;
  fab uuid; fab_nome text;
  serie jsonb; mes jsonb; ant jsonb; por_fechador jsonb; conc jsonb;
  alertas jsonb := '[]'::jsonb;
  pct numeric; pct_ant numeric;
begin
  s_ini := (s_fim - interval '12 months')::date;
  ts_ini := s_ini::timestamp at time zone v_tz; ts_fim := s_fim::timestamp at time zone v_tz;
  select s.id, s.name into fab, fab_nome from onboarding_staff s
   where s.role = 'master' and s.tenant_id is null and s.is_active order by s.created_at limit 1;

  with meses as (select generate_series(s_ini, (s_fim - interval '1 month')::date, interval '1 month')::date m),
  ganhos as (
    select date_trunc('month', (l.closed_at at time zone v_tz))::date m, coalesce(l.closer_staff_id, l.owner_staff_id) quem, coalesce(l.opportunity_value, 0) v
      from crm_leads l join crm_stages st on st.id = l.stage_id
     where st.final_type = 'won' and l.tenant_id is null and l.closed_at >= ts_ini and l.closed_at < ts_fim
  ),
  g as (
    select m, count(*) n, sum(v) v,
           count(*) filter (where quem = fab) n_f, coalesce(sum(v) filter (where quem = fab), 0) v_f,
           count(*) filter (where quem is null) n_s, coalesce(sum(v) filter (where quem is null), 0) v_s
      from ganhos group by m
  ),
  reun as (
    select date_trunc('month', (e.event_date at time zone v_tz))::date m, count(*) n,
           count(*) filter (where coalesce(e.owner_staff_id, e.credited_staff_id) = fab) n_f
      from crm_meeting_events e
     where e.event_type in ('realized','realized_out_of_icp') and e.event_date >= ts_ini and e.event_date < ts_fim group by 1
  )
  select jsonb_agg(jsonb_build_object(
      'mes', to_char(x.m, 'YYYY-MM-DD'),
      'vendas', g.n, 'receita', g.v,
      'vendas_fundador', g.n_f, 'receita_fundador', g.v_f,
      'vendas_sem_fechador', g.n_s, 'receita_sem_fechador', g.v_s,
      'vendas_time', g.n - g.n_f - g.n_s, 'receita_time', g.v - g.v_f - g.v_s,
      'pct_receita', case when g.v > 0 then round(g.v_f / g.v, 4) end,
      'pct_vendas', case when g.n > 0 then round(g.n_f::numeric / g.n, 4) end,
      'reunioes', r.n, 'reunioes_fundador', r.n_f,
      'pct_reunioes', case when r.n > 0 then round(r.n_f::numeric / r.n, 4) end
    ) order by x.m) into serie
    from meses x left join g on g.m = x.m left join reun r on r.m = x.m;

  select e into mes from jsonb_array_elements(serie) e where e->>'mes' = to_char(v_ini, 'YYYY-MM-DD');
  select e into ant from jsonb_array_elements(serie) e where e->>'mes' = to_char((v_ini - interval '1 month')::date, 'YYYY-MM-DD');
  pct := (mes->>'pct_receita')::numeric; pct_ant := (ant->>'pct_receita')::numeric;

  select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc), '[]') into por_fechador from (
    select jsonb_build_object('id', q.quem, 'nome', coalesce(s.name, 'Sem fechador (venda do site)'), 'papel', s.role,
             'grupo', case when q.quem is null then 'sem_fechador' when q.quem = fab then 'fundador' else 'time' end,
             'vendas', q.n, 'receita', q.v) x
      from (select coalesce(l.closer_staff_id, l.owner_staff_id) quem, count(*) n, sum(coalesce(l.opportunity_value, 0)) v
              from crm_leads l join crm_stages st on st.id = l.stage_id
             where st.final_type = 'won' and l.tenant_id is null
               and l.closed_at >= v_ini::timestamp at time zone v_tz and l.closed_at < (v_ini + interval '1 month')::timestamp at time zone v_tz
             group by 1) q
      left join onboarding_staff s on s.id = q.quem) y;

  ------------------------------------------------------------------ concentração
  with cob as (
    select r.company_id, r.amount_cents / 100.0 valor,
           (select max(i.due_date) from company_invoices i where i.recurring_charge_id = r.id) ult,
           exists (select 1 from company_invoices i where i.recurring_charge_id = r.id and i.paid_at is null and i.due_date >= hoje) fut
      from company_recurring_charges r where r.is_active and r.recurrence = 'monthly'
  ),
  base as (
    select c.id company_id, c.name empresa, sum(k.valor) valor, count(*) cobrancas, max(k.ult) parcelas_ate,
           c.contract_end_date contrato_fim, c.renewal_plan_type plano, st.name consultor
      from cob k join onboarding_companies c on c.id = k.company_id left join onboarding_staff st on st.id = c.consultant_id
     where c.status = 'active' and k.fut
     group by c.id, c.name, c.contract_end_date, c.renewal_plan_type, st.name
  ),
  tot as (select coalesce(sum(valor), 0) t, count(*) n from base),
  rk as (select b.*, row_number() over (order by b.valor desc, b.empresa) pos from base b)
  select jsonb_build_object(
    'mrr_base', t.t, 'clientes', t.n,
    'mrr_todas_ativas', (select coalesce(sum(valor), 0) from cob),
    'fora_valor', (select coalesce(sum(k.valor), 0) from cob k join onboarding_companies c on c.id = k.company_id where not (c.status = 'active' and k.fut)),
    'fora_n', (select count(*) from cob k join onboarding_companies c on c.id = k.company_id where not (c.status = 'active' and k.fut)),
    'maior', (select jsonb_build_object('empresa', empresa, 'company_id', company_id, 'valor', valor, 'pct', case when t.t > 0 then round(valor / t.t, 4) end) from rk where pos = 1),
    'top5_valor', (select coalesce(sum(valor), 0) from rk where pos <= 5),
    'top5_pct', case when t.t > 0 then round((select coalesce(sum(valor), 0) from rk where pos <= 5) / t.t, 4) end,
    'top10', (select coalesce(jsonb_agg(jsonb_build_object('pos', pos, 'company_id', company_id, 'empresa', empresa, 'valor', valor,
                'pct', case when t.t > 0 then round(valor / t.t, 4) end, 'cobrancas', cobrancas, 'parcelas_ate', parcelas_ate,
                'contrato_fim', contrato_fim, 'plano', plano, 'consultor', consultor) order by pos), '[]') from rk where pos <= 10)
  ) into conc from tot t;

  if (conc #>> '{maior,pct}')::numeric > 0.15 then
    alertas := alertas || jsonb_build_object('area', 'clientes', 'gravidade', 'media',
      'titulo', (conc #>> '{maior,empresa}') || ' concentra ' || round((conc #>> '{maior,pct}')::numeric * 100) || '% das mensalidades',
      'detalhe', painel_brl((conc #>> '{maior,valor}')::numeric) || ' de ' || painel_brl((conc->>'mrr_base')::numeric) || ' por mês. Acima de 15% num cliente só, a saída dele vira problema de caixa.',
      'link', '/onboarding-tasks/companies', 'view', 'fundador');
  end if;
  if (conc->>'top5_pct')::numeric > 0.50 then
    alertas := alertas || jsonb_build_object('area', 'clientes', 'gravidade', 'media',
      'titulo', 'Os 5 maiores clientes concentram ' || round((conc->>'top5_pct')::numeric * 100) || '% das mensalidades',
      'detalhe', painel_brl((conc->>'top5_valor')::numeric) || ' de ' || painel_brl((conc->>'mrr_base')::numeric) || ' por mês em cinco clientes.',
      'link', '/onboarding-tasks/companies', 'view', 'fundador');
  end if;

  return jsonb_build_object(
    'fundador', jsonb_build_object(
      'staff_id', fab, 'nome', fab_nome, 'mes', mes,
      'pct_receita', pct, 'pct_receita_anterior', pct_ant,
      'delta_pp', case when pct is not null and pct_ant is not null then round((pct - pct_ant) * 100, 1) end,
      'nivel', case when pct is null then null when pct < 0.30 then 'verde' when pct <= 0.60 then 'ambar' else 'vermelho' end,
      'por_fechador', por_fechador, 'serie', serie),
    'concentracao', conc,
    'alertas', alertas);
end $$;

create or replace function public.painel_frente_interno(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare caixa jsonb; fund jsonb;
begin
  caixa := painel_caixa_interno();
  fund := painel_fundador_interno(p_month);
  return jsonb_build_object(
    'caixa', caixa - 'alertas',
    'fundador', fund->'fundador',
    'concentracao', fund->'concentracao',
    'alertas', coalesce(caixa->'alertas', '[]'::jsonb) || coalesce(fund->'alertas', '[]'::jsonb));
end $$;

-- Listas de detalhe dos blocos "pra frente":
--   caixa_movimentos {de, ate, tipo: entrada|saida, classe}
--   vendas_grupo     {grupo: fundador|time|sem_fechador}
--   mrr_clientes     {grupo: base|fora}
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

  else
    raise exception 'Bloco desconhecido: %', p_bloco;
  end case;

  return saida || jsonb_build_object('bloco', p_bloco, 'mes', to_char(v_ini, 'YYYY-MM-DD'), 'limite', 500);
end $$;

revoke all on function public.painel_fundador_interno(date) from public, anon, authenticated;
grant execute on function public.painel_fundador_interno(date) to service_role;
revoke all on function public.painel_frente_interno(date) from public, anon, authenticated;
grant execute on function public.painel_frente_interno(date) to service_role;
revoke all on function public.painel_frente_detalhe(date, text, jsonb) from public, anon;
grant execute on function public.painel_frente_detalhe(date, text, jsonb) to authenticated;
