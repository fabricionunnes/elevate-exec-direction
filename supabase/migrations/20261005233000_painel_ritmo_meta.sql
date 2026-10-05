-- Painel de Controle: ritmo da meta do mês e meta anual de lucro (05/10/2026).
--
-- Ritmo: receita vendida no mês (leads ganhos, todos os fechadores) contra a meta
-- de vendas do CRM (crm_goal_values, tipo "Vendas", staff ativo que não é head).
-- Projeção de fechamento = vendido / dias úteis já passados x dias úteis do mês.
-- Dia útil = dia aberto em crm_business_hours e fora de crm_holidays; sem a
-- tabela de horário, segunda a sexta. Hoje conta como dia passado.
-- Leitura: projeção igual ou acima da meta verde, de 80% a 100% âmbar, abaixo
-- vermelho. Quem vende e não tem meta cadastrada vem na lista "sem_meta".
--
-- Lucro do ano: recebido menos pago, mês a mês (caixa, igual ao resto do painel).
-- Só entram os meses em que existe recebimento registrado: as faturas dos clientes
-- passaram a ser lançadas no Nexus em maio/2026, e os meses antes disso teriam só
-- saída (prejuízo falso). Projeção anualizada = lucro dos meses fechados + a média
-- deles pelos meses que faltam do ano. A meta fica em painel_config e o master
-- muda na própria tela.

create table if not exists public.painel_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table public.painel_config enable row level security;
drop policy if exists painel_config_master_le on public.painel_config;
create policy painel_config_master_le on public.painel_config for select to authenticated using (public.is_master());
-- escrita só pela RPC abaixo (security definer), que confere o master e a chave
revoke all on public.painel_config from anon, authenticated;
grant select on public.painel_config to authenticated;
grant all on public.painel_config to service_role;

insert into public.painel_config (chave, valor) values ('meta_lucro_ano', '2000000'::jsonb) on conflict (chave) do nothing;

create or replace function public.painel_config_definir(p_chave text, p_valor numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_master() then raise exception 'Só o master'; end if;
  if p_chave not in ('meta_lucro_ano') then raise exception 'Configuração desconhecida: %', p_chave; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 1000000000 then raise exception 'Valor inválido'; end if;
  insert into painel_config (chave, valor, atualizado_em, atualizado_por)
  values (p_chave, to_jsonb(round(p_valor, 2)), now(), auth.uid())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return jsonb_build_object('chave', p_chave, 'valor', round(p_valor, 2));
end $$;

create or replace function public.painel_dia_util(d date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from crm_holidays h where h.date = d) then false
    when exists (select 1 from crm_business_hours) then coalesce((select b.is_open from crm_business_hours b where b.weekday = extract(dow from d)::int limit 1), false)
    else extract(dow from d) between 1 and 5 end;
$$;

create or replace function public.painel_ritmo_interno(p_month date default null)
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
  v_fim date;
  meta jsonb; v_meta numeric; vendido numeric; n_vendas int;
  du_total int; du_passados int; du_restantes int;
  ritmo numeric; proj numeric; falta numeric;
  por jsonb;
  -- lucro do ano
  ano int := extract(year from (now() at time zone 'America/Sao_Paulo')::date)::int;
  a_ini date; mes_atual date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
  meta_lucro numeric; meses jsonb; acumulado numeric; fech_soma numeric; fech_n int; media numeric; proj_ano numeric;
  primeiro date; rest_meses numeric; dias_mes int;
begin
  v_fim := (v_ini + interval '1 month')::date;
  meta := painel_meta_mes_interno(v_ini);
  v_meta := (meta->>'meta')::numeric;

  select coalesce(sum(l.opportunity_value), 0), count(*) into vendido, n_vendas
    from crm_leads l join crm_stages st on st.id = l.stage_id
   where st.final_type = 'won' and l.tenant_id is null
     and l.closed_at >= v_ini::timestamp at time zone v_tz and l.closed_at < v_fim::timestamp at time zone v_tz;

  select count(*) filter (where painel_dia_util(g::date)),
         count(*) filter (where painel_dia_util(g::date) and g::date <= hoje)
    into du_total, du_passados
    from generate_series(v_ini, v_fim - 1, interval '1 day') g;
  du_restantes := du_total - du_passados;
  ritmo := case when du_passados > 0 then round(vendido / du_passados, 2) end;
  proj := case when du_passados > 0 then round(vendido / du_passados * du_total, 2) end;
  falta := case when v_meta is not null then greatest(v_meta - vendido, 0) end;

  -- vendido por quem fechou, com a meta de cada um do lado
  select coalesce(jsonb_agg(x order by (x->>'receita')::numeric desc, x->>'nome'), '[]') into por from (
    select jsonb_build_object('staff_id', q.id, 'nome', q.nome, 'vendas', q.n, 'receita', q.v, 'meta', q.meta,
             'pct', case when q.meta > 0 then round(q.v / q.meta, 4) end) x
      from (
        select s.id, coalesce(s.name, 'Sem fechador (venda do site)') nome, coalesce(g.n, 0) n, coalesce(g.v, 0) v,
               (select (c->>'meta')::numeric from jsonb_array_elements(meta->'com_meta') c where (c->>'staff_id')::uuid = s.id) meta
          from (select coalesce(l.closer_staff_id, l.owner_staff_id) quem, count(*) n, sum(coalesce(l.opportunity_value, 0)) v
                  from crm_leads l join crm_stages st on st.id = l.stage_id
                 where st.final_type = 'won' and l.tenant_id is null
                   and l.closed_at >= v_ini::timestamp at time zone v_tz and l.closed_at < v_fim::timestamp at time zone v_tz
                 group by 1) g
          full join (select (c->>'staff_id')::uuid id from jsonb_array_elements(meta->'com_meta') c) m on m.id = g.quem
          left join onboarding_staff s on s.id = coalesce(g.quem, m.id)
      ) q) y;

  ------------------------------------------------------------------ lucro do ano
  a_ini := make_date(ano, 1, 1);
  select (c.valor #>> '{}')::numeric into meta_lucro from painel_config c where c.chave = 'meta_lucro_ano';
  meta_lucro := coalesce(meta_lucro, 2000000);

  with ms as (select generate_series(a_ini, mes_atual, interval '1 month')::date m),
  rec as (select date_trunc('month', (i.paid_at at time zone v_tz))::date m, sum(coalesce(i.paid_amount_cents, i.amount_cents)) / 100.0 v
            from company_invoices i where i.status = 'paid' and i.paid_at >= a_ini::timestamp at time zone v_tz group by 1),
  pag as (select date_trunc('month', y.paid_date)::date m, sum(coalesce(y.paid_amount, y.amount)) v
            from financial_payables y where y.status = 'paid' and y.tenant_id is null and y.paid_date >= a_ini group by 1),
  l0 as (
    select ms.m, rec.v recebido, pag.v pago,
           case when rec.m is not null then rec.v - coalesce(pag.v, 0) end lucro
      from ms left join rec on rec.m = ms.m left join pag on pag.m = ms.m
  ),
  linha as (select l0.*, sum(l0.lucro) over (order by l0.m) acum from l0)
  select jsonb_agg(jsonb_build_object('mes', to_char(m, 'YYYY-MM-DD'), 'recebido', recebido, 'pago', pago, 'lucro', lucro,
           'fechado', m < mes_atual, 'acumulado', acum) order by m),
         coalesce(sum(lucro), 0), coalesce(sum(lucro) filter (where m < mes_atual), 0), count(lucro) filter (where m < mes_atual), min(m) filter (where lucro is not null)
    into meses, acumulado, fech_soma, fech_n, primeiro
    from linha;

  media := case when fech_n > 0 then round(fech_soma / fech_n, 2) end;
  -- meses que faltam do ano, contando o corrente inteiro
  proj_ano := case when media is not null then round(fech_soma + media * (12 - extract(month from mes_atual)::int + 1), 2) end;
  dias_mes := extract(day from (mes_atual + interval '1 month' - interval '1 day'))::int;
  rest_meses := (12 - extract(month from mes_atual)::int) + round((dias_mes - extract(day from hoje)::int)::numeric / dias_mes, 2);

  return jsonb_build_object(
    'mes', to_char(v_ini, 'YYYY-MM-DD'), 'hoje', hoje,
    'meta', meta, 'vendido', vendido, 'vendas', n_vendas, 'falta', falta,
    'pct_meta', case when v_meta > 0 then round(vendido / v_meta, 4) end,
    'dias_uteis', jsonb_build_object('total', du_total, 'passados', du_passados, 'restantes', du_restantes,
                                     'pct_tempo', case when du_total > 0 then round(du_passados::numeric / du_total, 4) end),
    'ritmo_dia', ritmo, 'projecao', proj,
    'por_dia_restante', case when falta is not null and du_restantes > 0 then round(falta / du_restantes, 2) end,
    'nivel', case when v_meta is null or du_passados = 0 then null when vendido >= v_meta then 'verde' when proj >= v_meta then 'verde' when proj >= 0.8 * v_meta then 'ambar' else 'vermelho' end,
    'por_fechador', por,
    'lucro_ano', jsonb_build_object(
      'ano', ano, 'meta', meta_lucro, 'acumulado', acumulado, 'meses', meses,
      'primeiro_mes', primeiro, 'meses_fechados', fech_n, 'media_mes', media, 'projecao', proj_ano,
      'falta', greatest(meta_lucro - acumulado, 0), 'meses_restantes', rest_meses,
      'precisa_por_mes', case when rest_meses > 0 then round(greatest(meta_lucro - acumulado, 0) / rest_meses, 2) end,
      'pct', case when meta_lucro > 0 then round(acumulado / meta_lucro, 4) end),
    'alertas', '[]'::jsonb);
end $$;

create or replace function public.painel_frente_interno(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare caixa jsonb; fund jsonb; ant jsonb; rit jsonb;
begin
  caixa := painel_caixa_interno();
  fund := painel_fundador_interno(p_month);
  ant := painel_antecedentes_interno();
  rit := painel_ritmo_interno(p_month);
  return jsonb_build_object(
    'caixa', caixa - 'alertas',
    'fundador', fund->'fundador',
    'concentracao', fund->'concentracao',
    'antecedentes', ant - 'alertas',
    'ritmo', rit - 'alertas',
    'alertas', coalesce(caixa->'alertas', '[]'::jsonb) || coalesce(ant->'alertas', '[]'::jsonb) || coalesce(fund->'alertas', '[]'::jsonb) || coalesce(rit->'alertas', '[]'::jsonb));
end $$;

revoke all on function public.painel_config_definir(text, numeric) from public, anon;
grant execute on function public.painel_config_definir(text, numeric) to authenticated;
revoke all on function public.painel_dia_util(date) from public, anon, authenticated;
grant execute on function public.painel_dia_util(date) to service_role;
revoke all on function public.painel_ritmo_interno(date) from public, anon, authenticated;
grant execute on function public.painel_ritmo_interno(date) to service_role;
revoke all on function public.painel_frente_interno(date) from public, anon, authenticated;
grant execute on function public.painel_frente_interno(date) to service_role;
