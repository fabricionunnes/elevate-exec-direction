-- Painel de Controle: projeção de caixa de 13 semanas (05/10/2026).
--
-- O painel só mostrava o saldo e o "a pagar em 7 dias". Aqui entra a linha do
-- tempo: saldo de hoje + o que está previsto pra entrar e sair, dia a dia, por
-- 91 dias, em dois cenários.
--
-- De onde vem cada coisa (conferido no dado, não suposto):
-- - Saldo inicial: soma de financial_banks ativas da UNV (o mesmo do painel).
-- - Entradas: company_invoices em aberto pelo vencimento. As recorrências
--   (company_recurring_charges) já nascem com as parcelas todas geradas como
--   fatura, então não se soma recorrência por cima: seria contar duas vezes. A
--   única projeção sem fatura é a "renovação presumida" de plano de 12 parcelas
--   ou mais que termina dentro do horizonte, de empresa ativa e fora de aviso, e
--   ela só entra no cenário contratado. Recorrência de parcela única é cobrança
--   avulsa (nenhuma gerou segunda fatura) e não se projeta.
-- - financial_receivables NÃO entra: é legado importado (vencidos de 2024 a
--   jan/2026, sem empresa), não é a mesma coisa que as faturas. O total fica em
--   "fora" pra ninguém achar que sumiu.
-- - Saídas: financial_payables em aberto pelo vencimento. Conta recorrente
--   também já nasce com as parcelas geradas (há linhas até 2029).
--
-- Cenários:
-- - contratado: tudo entra e sai no vencimento. Vencido há até 30 dias entra
--   hoje; vencido há mais de 30 dias fica fora (a tela tem a chave pra incluir).
-- - realista: fatura a vencer vale valor x taxa de recebimento (parte do valor
--   das faturas dos últimos 3 meses paga até 7 dias depois do vencimento) e
--   chega no vencimento + atraso médio. Fatura de empresa inativa, ou com
--   vencimento depois do fim do aviso de saída, fica fora. Vencida há 8 a 90
--   dias vale valor x taxa de recuperação histórica (quanto das faturas que
--   passaram de 7 dias de atraso acabou sendo pago) e chega no prazo médio de
--   recuperação. Vencida há mais de 90 dias fica fora. Saída é igual nos dois.
--   Sem amostra pra medir uma taxa, ela volta nula e a regra correspondente não
--   se aplica (e a tela diz).
--
-- Funções internas (execute só pra service_role; o master entra pelos wrappers):
--   painel_caixa_taxas(), painel_caixa_itens(), painel_caixa_interno(),
--   painel_frente_interno(p_month).
-- Wrapper master: painel_frente_detalhe(p_month, p_bloco, p_filtro).

-- "R$ 15.671" / "-R$ 143.495": dinheiro inteiro pros textos de alerta
create or replace function public.painel_brl(v numeric)
returns text
language sql
immutable
set search_path = public
as $$
  select case when v is null then '-' else case when v < 0 then '-' else '' end || 'R$ ' || replace(to_char(abs(round(v)), 'FM999G999G990'), ',', '.') end;
$$;

create or replace function public.painel_caixa_taxas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with h as (select (now() at time zone 'America/Sao_Paulo')::date d),
  base as (
    select i.amount_cents v, i.due_date, (i.paid_at at time zone 'America/Sao_Paulo')::date pago
      from company_invoices i, h
     where i.status <> 'cancelled' and i.due_date between h.d - 97 and h.d - 7
  ),
  b as (
    select count(*) n, coalesce(sum(v),0) total,
           coalesce(sum(v) filter (where pago is not null and pago <= due_date + 7),0) pago7,
           avg(greatest(0, pago - due_date)) filter (where pago is not null and pago <= due_date + 7) atraso
      from base
  ),
  tarde as (
    -- faturas que passaram de 7 dias de atraso, em qualquer época
    select i.amount_cents v, i.due_date, (i.paid_at at time zone 'America/Sao_Paulo')::date pago
      from company_invoices i, h
     where i.status <> 'cancelled' and i.due_date <= h.d - 8
       and (i.paid_at is null or (i.paid_at at time zone 'America/Sao_Paulo')::date > i.due_date + 7)
  ),
  l as (
    select count(*) n, coalesce(sum(v),0) total, coalesce(sum(v) filter (where pago is not null),0) rec,
           avg(pago - due_date) filter (where pago is not null) dias
      from tarde
  )
  select jsonb_build_object(
    'janela_de', h.d - 97, 'janela_ate', h.d - 7,
    'amostra_n', b.n, 'amostra_valor', b.total / 100.0, 'pago_7d_valor', b.pago7 / 100.0,
    'taxa_7d', case when b.n >= 10 and b.total > 0 then round(b.pago7::numeric / b.total, 4) end,
    'atraso_medio_dias', case when b.n >= 10 then round(coalesce(b.atraso, 0))::int end,
    'recuperacao_n', l.n, 'recuperacao_valor', l.total / 100.0, 'recuperado_valor', l.rec / 100.0,
    'taxa_recuperacao', case when l.n >= 5 and l.total > 0 then round(l.rec::numeric / l.total, 4) end,
    'dias_recuperacao', case when l.n >= 5 and l.dias is not null then round(l.dias)::int end)
  from h, b, l;
$$;

create or replace function public.painel_caixa_itens()
returns table (
  tipo text, origem text, ref_id uuid, company_id uuid, nome text, descricao text, vencimento date, valor numeric,
  classe text, dias_atraso int, data_c date, valor_c numeric, data_r date, valor_r numeric, motivo_r text
)
language sql
stable
security definer
set search_path = public
as $$
  with h as (select (now() at time zone 'America/Sao_Paulo')::date d),
  p as (
    select (t->>'taxa_7d')::numeric taxa7, coalesce((t->>'atraso_medio_dias')::int, 0) atraso,
           (t->>'taxa_recuperacao')::numeric recup, coalesce((t->>'dias_recuperacao')::int, 21) drecup
      from (select painel_caixa_taxas() t) x
  ),
  aviso as (
    select pr.onboarding_company_id cid, min(pr.notice_end_date) fim
      from onboarding_projects pr where pr.status in ('notice_period','cancellation_signaled') group by 1
  ),
  fat as (
    select i.id, i.company_id, c.name nome, i.description, i.due_date, i.amount_cents / 100.0 valor,
           c.status emp, a.cid is not null em_aviso, a.fim aviso_fim, h.d hoje, h.d - i.due_date atraso
      from company_invoices i join onboarding_companies c on c.id = i.company_id
      left join aviso a on a.cid = c.id, h
     where i.paid_at is null and i.status in ('pending','overdue') and i.due_date <= h.d + 90
  ),
  ren as (
    -- renovação presumida: plano de 12+ parcelas que termina no horizonte
    select r.id, r.company_id, c.name nome, r.description, (u.ult + make_interval(months => g.k))::date due, r.amount_cents / 100.0 valor
      from company_recurring_charges r join onboarding_companies c on c.id = r.company_id
      join lateral (select max(i.due_date) ult from company_invoices i where i.recurring_charge_id = r.id) u on u.ult is not null
      cross join generate_series(1, 4) g(k), h
     where r.is_active and r.recurrence = 'monthly' and coalesce(r.installments, 1) >= 12 and c.status = 'active'
       and not exists (select 1 from aviso a where a.cid = c.id)
       and u.ult >= h.d - 31
       and (u.ult + make_interval(months => g.k))::date between h.d and h.d + 90
  ),
  pag as (
    select y.id, y.supplier_name nome, y.description, y.due_date, y.amount - coalesce(y.paid_amount, 0) valor, h.d hoje, h.d - y.due_date atraso
      from financial_payables y, h
     where y.status in ('pending','partial') and y.tenant_id is null and y.due_date <= h.d + 90
       and y.amount - coalesce(y.paid_amount, 0) > 0
  )
  -- faturas
  select 'entrada', 'fatura', f.id, f.company_id, f.nome, f.description, f.due_date, f.valor,
         case when f.atraso <= 0 then 'a_vencer' when f.atraso <= 30 then 'vencida_recente' else 'vencida_antiga' end,
         greatest(f.atraso, 0),
         case when f.atraso <= 0 then f.due_date when f.atraso <= 30 then f.hoje end,
         case when f.atraso <= 30 then f.valor end,
         r.data_r, r.valor_r, r.motivo
    from fat f, p,
    lateral (
      select
        case
          when f.atraso <= 7 and (f.emp <> 'active' or (f.em_aviso and f.aviso_fim is not null and f.due_date > f.aviso_fim)) then null
          when f.atraso <= 0 then least(f.due_date + p.atraso, f.hoje + 90)
          when f.atraso <= 7 then f.hoje
          when f.atraso <= 90 and p.recup is not null then least(greatest(f.hoje + 7, f.due_date + p.drecup), f.hoje + 90)
        end data_r,
        case
          when f.atraso <= 7 and (f.emp <> 'active' or (f.em_aviso and f.aviso_fim is not null and f.due_date > f.aviso_fim)) then null
          when f.atraso <= 7 then round(f.valor * coalesce(p.taxa7, 1), 2)
          when f.atraso <= 90 and p.recup is not null then round(f.valor * p.recup, 2)
        end valor_r,
        case
          when f.atraso <= 7 and f.emp <> 'active' then 'empresa inativa'
          when f.atraso <= 7 and f.em_aviso and f.aviso_fim is not null and f.due_date > f.aviso_fim then 'vence depois do fim do aviso de saída'
          when f.atraso <= 7 then case when p.taxa7 is null then 'sem amostra pra taxa de recebimento: valor cheio' else 'taxa de recebimento' end
          when f.atraso <= 90 and p.recup is not null then 'vencida: taxa de recuperação'
          when f.atraso <= 90 then 'vencida: sem amostra pra medir recuperação'
          else 'vencida há mais de 90 dias'
        end motivo
    ) r
  union all
  select 'entrada', 'renovacao', n.id, n.company_id, n.nome, n.description, n.due, n.valor, 'renovacao', 0, n.due, n.valor, null::date, null::numeric,
         'renovação presumida: ainda não tem fatura'
    from ren n
  union all
  -- contas a pagar: iguais nos dois cenários
  select 'saida', 'conta', g.id, null::uuid, g.nome, g.description, g.due_date, g.valor,
         case when g.atraso <= 0 then 'a_vencer' when g.atraso <= 30 then 'vencida_recente' else 'vencida_antiga' end,
         greatest(g.atraso, 0),
         case when g.atraso <= 0 then g.due_date when g.atraso <= 30 then g.hoje end,
         case when g.atraso <= 30 then g.valor end,
         case when g.atraso <= 0 then g.due_date when g.atraso <= 30 then g.hoje end,
         case when g.atraso <= 30 then g.valor end,
         case when g.atraso > 30 then 'vencida há mais de 30 dias: conferir se ainda é devida' end
    from pag g;
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

  return res || jsonb_build_object('alertas', alertas);
end $$;

-- Tudo que é "pra frente" num objeto só. Cada bloco novo entra aqui com a sua
-- chave e os seus alertas; painel_controle só chama esta função.
create or replace function public.painel_frente_interno(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare caixa jsonb;
begin
  caixa := painel_caixa_interno();
  return jsonb_build_object(
    'caixa', caixa - 'alertas',
    'alertas', coalesce(caixa->'alertas', '[]'::jsonb));
end $$;

-- Listas de detalhe dos blocos "pra frente". Mesmo contrato da
-- painel_controle_detalhe: {bloco, total, linhas, limite}.
--   caixa_movimentos {de, ate, tipo: entrada|saida, classe}
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
  saida jsonb;
begin
  if not is_master() then raise exception 'Só o master'; end if;

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
      'sai', (select coalesce(sum(coalesce(valor_c, valor)), 0) from base where tipo = 'saida'),
      'soma', (select coalesce(sum(valor), 0) from base),
      'linhas', (select coalesce(jsonb_agg(to_jsonb(b) order by b.tipo, coalesce(b.data_c, b.data_r, b.vencimento), b.valor desc), '[]')
                   from (select * from base order by tipo, coalesce(data_c, data_r, vencimento), valor desc limit 500) b)) into saida;

  else
    raise exception 'Bloco desconhecido: %', p_bloco;
  end case;

  return saida || jsonb_build_object('bloco', p_bloco, 'mes', to_char(date_trunc('month', coalesce(p_month, current_date)), 'YYYY-MM-DD'), 'limite', 500);
end $$;

revoke all on function public.painel_brl(numeric) from public, anon;
grant execute on function public.painel_brl(numeric) to authenticated, service_role;
revoke all on function public.painel_caixa_taxas() from public, anon, authenticated;
revoke all on function public.painel_caixa_itens() from public, anon, authenticated;
revoke all on function public.painel_caixa_interno() from public, anon, authenticated;
revoke all on function public.painel_frente_interno(date) from public, anon, authenticated;
grant execute on function public.painel_caixa_taxas() to service_role;
grant execute on function public.painel_caixa_itens() to service_role;
grant execute on function public.painel_caixa_interno() to service_role;
grant execute on function public.painel_frente_interno(date) to service_role;

revoke all on function public.painel_frente_detalhe(date, text, jsonb) from public, anon;
grant execute on function public.painel_frente_detalhe(date, text, jsonb) to authenticated;
