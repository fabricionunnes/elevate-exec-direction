-- Histórico consolidado de todos os anos, lido do que está lançado no financeiro.
-- Receita = recebível baixado mais mensalidade paga; despesa = conta a pagar baixada.
-- Sempre regime de caixa, pela data de pagamento, igual ao resto do Planejamento.
--
-- A função devolve o dado cru por mês e os três cortes de despesa que têm
-- cobertura no banco (categoria, centro de custo e fornecedor). Tudo que é
-- comparação derivada (mesmo mês ano a ano, acumulado, trimestre, semestre,
-- crescimento encadeado) a tela calcula em cima de 'meses': assim dá pra mudar
-- o recorte sem mexer no banco.
create or replace function public.planejamento_historico_interno()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare saida jsonb;
begin
  with mov as (
    select to_char(paid_date,'YYYY-MM') ym, amount rec, 0::numeric pag
      from financial_receivables where tenant_id is null and paid_date is not null
    union all
    select to_char(paid_at,'YYYY-MM'), amount_cents/100.0, 0
      from company_invoices where status = 'paid' and paid_at is not null
    union all
    select to_char(paid_date,'YYYY-MM'), 0, amount
      from financial_payables where tenant_id is null and status = 'paid' and paid_date is not null
  ),
  meses as (
    select ym, round(sum(rec),2) rr, round(sum(pag),2) dd,
           count(*) filter (where rec > 0) qr,
           count(*) filter (where pag > 0) qd
      from mov group by ym
  ),
  anos as (
    select left(ym,4) ano, round(sum(rr),2) rr, round(sum(dd),2) dd,
           count(*) filter (where rr > 0 or dd > 0) com_dado,
           sum(qr) qr, sum(qd) qd
      from meses group by left(ym,4)
  ),
  cat as (
    select to_char(paid_date,'YYYY') ano,
           coalesce(nullif(trim(substring(notes from 'Categoria: ([^|]+)')), ''), 'Sem categoria') nome,
           round(sum(amount),2) v
      from financial_payables
     where tenant_id is null and status = 'paid' and paid_date is not null
     group by 1, 2
  ),
  cc as (
    select to_char(p.paid_date,'YYYY') ano,
           coalesce(nullif(trim(p.cost_center), ''), c.name, 'Sem centro de custo') nome,
           round(sum(p.amount),2) v
      from financial_payables p
      left join staff_financial_cost_centers c on c.id = p.cost_center_id
     where p.tenant_id is null and p.status = 'paid' and p.paid_date is not null
     group by 1, 2
  ),
  forn as (
    select ano, nome, v, n from (
      select to_char(paid_date,'YYYY') ano,
             coalesce(nullif(trim(supplier_name), ''), 'Sem fornecedor') nome,
             round(sum(amount),2) v, count(*) n,
             row_number() over (partition by to_char(paid_date,'YYYY') order by sum(amount) desc) pos
        from financial_payables
       where tenant_id is null and status = 'paid' and paid_date is not null
       group by 1, 2
    ) x where pos <= 15
  )
  select jsonb_build_object(
    'meses', coalesce((select jsonb_agg(jsonb_build_object('ym', ym, 'r', rr, 'd', dd, 'qr', qr, 'qd', qd) order by ym) from meses), '[]'::jsonb),
    'anos', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'r', rr, 'd', dd, 'meses', com_dado, 'qr', qr, 'qd', qd) order by ano) from anos), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'cat', nome, 'v', v) order by ano, v desc) from cat where v >= 3000), '[]'::jsonb),
    'centros', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'cat', nome, 'v', v) order by ano, v desc) from cc where v >= 3000), '[]'::jsonb),
    'fornecedores', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'cat', nome, 'v', v, 'n', n) order by ano, v desc) from forn), '[]'::jsonb)
  ) into saida;

  return saida;
end $function$;

create or replace function public.planejamento_historico()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not is_master() then
    raise exception 'sem permissão';
  end if;
  return planejamento_historico_interno();
end $function$;

revoke all on function public.planejamento_historico_interno() from public, anon, authenticated;
revoke all on function public.planejamento_historico() from public, anon;
grant execute on function public.planejamento_historico() to authenticated;
