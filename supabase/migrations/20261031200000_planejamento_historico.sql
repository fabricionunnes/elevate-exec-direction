-- Histórico consolidado de todos os anos, lido do que está lançado no financeiro.
-- Receita = recebível baixado mais mensalidade paga; despesa = conta a pagar baixada.
-- Sempre regime de caixa, pela data de pagamento, igual ao resto do Planejamento.
create or replace function public.planejamento_historico()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare r jsonb;
begin
  if not is_master() then
    raise exception 'sem permissão';
  end if;

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
    select ym, round(sum(rec),2) r, round(sum(pag),2) d from mov group by ym
  ),
  anos as (
    select left(ym,4) ano, round(sum(r),2) r, round(sum(d),2) d,
           count(*) filter (where r > 0 or d > 0) meses_com_dado
      from meses group by left(ym,4)
  ),
  cat as (
    select to_char(paid_date,'YYYY') ano,
           coalesce(nullif(trim(substring(notes from 'Categoria: ([^|]+)')), ''), 'Sem categoria') categoria,
           round(sum(amount),2) v
      from financial_payables
     where tenant_id is null and status = 'paid' and paid_date is not null
     group by 1, 2
  )
  select jsonb_build_object(
    'meses', coalesce((select jsonb_agg(jsonb_build_object('ym', ym, 'r', r, 'd', d) order by ym) from meses), '[]'::jsonb),
    'anos', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'r', r, 'd', d, 'meses', meses_com_dado) order by ano) from anos), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'cat', categoria, 'v', v) order by ano, v desc) from cat where v >= 5000), '[]'::jsonb)
  ) into r;

  return r;
end $function$;

revoke all on function public.planejamento_historico() from public;
grant execute on function public.planejamento_historico() to authenticated;
