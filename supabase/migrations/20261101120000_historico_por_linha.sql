-- Histórico consolidado, agora com corte por linha de negócio.
--
-- A linha sai de onde o dado de fato a identifica, e só de lá:
--   receita  -> centro de custo da mensalidade, ou o prefixo "UNV Ads -" /
--               "UNV Social -" na descrição. Existe de maio/2026 em diante,
--               quando a cobrança passou a ser emitida dentro do Nexus.
--   despesa  -> centro de custo do pagamento. Existe de julho/2025 em diante.
-- Recebível de extrato bancário não tem produto nenhum, então cai em Principal.
-- Por isso 'Principal' é literalmente "tudo que não é Ads nem Social", e no
-- período anterior a maio/2026 ele carrega Ads e Social dentro dele.
create or replace function public.planejamento_historico_interno()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare saida jsonb;
begin
  with mov as (
    select to_char(r.paid_date,'YYYY-MM') ym, 'Principal'::text linha, r.amount rec, 0::numeric pag
      from financial_receivables r where r.tenant_id is null and r.paid_date is not null
    union all
    select to_char(i.paid_at,'YYYY-MM'),
           case when coalesce(c.name,'') ilike '%ads%' or i.description ilike 'UNV Ads%' then 'UNV Ads'
                when coalesce(c.name,'') ilike '%social%' or i.description ilike 'UNV Social%' then 'UNV Social'
                else 'Principal' end,
           i.amount_cents/100.0, 0
      from company_invoices i
      left join staff_financial_cost_centers c on c.id = i.cost_center_id
     where i.status = 'paid' and i.paid_at is not null
    union all
    select to_char(p.paid_date,'YYYY-MM'),
           case when coalesce(nullif(trim(p.cost_center),''), cc.name, '') = 'UNV Ads' then 'UNV Ads'
                when coalesce(nullif(trim(p.cost_center),''), cc.name, '') = 'UNV Social' then 'UNV Social'
                else 'Principal' end,
           0, p.amount
      from financial_payables p
      left join staff_financial_cost_centers cc on cc.id = p.cost_center_id
     where p.tenant_id is null and p.status = 'paid' and p.paid_date is not null
  ),
  ml as (
    select ym, linha, round(sum(rec),2) rr, round(sum(pag),2) dd,
           count(*) filter (where rec > 0) qr, count(*) filter (where pag > 0) qd
      from mov group by ym, linha
  ),
  meses as (
    select ym, round(sum(rr),2) rr, round(sum(dd),2) dd, sum(qr) qr, sum(qd) qd
      from ml group by ym
  ),
  anos as (
    select left(ym,4) ano, round(sum(rr),2) rr, round(sum(dd),2) dd,
           count(*) filter (where rr > 0 or dd > 0) com_dado, sum(qr) qr, sum(qd) qd
      from meses group by left(ym,4)
  ),
  cat as (
    select to_char(paid_date,'YYYY') ano,
           coalesce(nullif(trim(substring(notes from 'Categoria: ([^|]+)')), ''), 'Sem categoria') nome,
           round(sum(amount),2) v
      from financial_payables
     where tenant_id is null and status = 'paid' and paid_date is not null group by 1, 2
  ),
  cc2 as (
    select to_char(p.paid_date,'YYYY') ano,
           coalesce(nullif(trim(p.cost_center), ''), c.name, 'Sem centro de custo') nome,
           round(sum(p.amount),2) v
      from financial_payables p
      left join staff_financial_cost_centers c on c.id = p.cost_center_id
     where p.tenant_id is null and p.status = 'paid' and p.paid_date is not null group by 1, 2
  ),
  forn as (
    select ano, nome, v, n from (
      select to_char(paid_date,'YYYY') ano,
             coalesce(nullif(trim(supplier_name), ''), 'Sem fornecedor') nome,
             round(sum(amount),2) v, count(*) n,
             row_number() over (partition by to_char(paid_date,'YYYY') order by sum(amount) desc) pos
        from financial_payables
       where tenant_id is null and status = 'paid' and paid_date is not null group by 1, 2
    ) x where pos <= 15
  ),
  -- fornecedor de cada linha, para a tela de Ads e de Social
  fl as (
    select linha, nome, v, n from (
      select case when coalesce(nullif(trim(p.cost_center),''), c.name, '') = 'UNV Ads' then 'UNV Ads'
                  else 'UNV Social' end linha,
             coalesce(nullif(trim(p.supplier_name), ''), 'Sem fornecedor') nome,
             round(sum(p.amount),2) v, count(*) n,
             row_number() over (partition by case when coalesce(nullif(trim(p.cost_center),''), c.name, '') = 'UNV Ads'
                                                  then 'UNV Ads' else 'UNV Social' end
                                order by sum(p.amount) desc) pos
        from financial_payables p
        left join staff_financial_cost_centers c on c.id = p.cost_center_id
       where p.tenant_id is null and p.status = 'paid' and p.paid_date is not null
         and coalesce(nullif(trim(p.cost_center),''), c.name, '') in ('UNV Ads','UNV Social')
       group by 1, 2
    ) y where pos <= 12
  ),
  -- clientes distintos por linha e mês, só existe de maio/2026 em diante
  cli as (
    select to_char(i.paid_at,'YYYY-MM') ym,
           case when coalesce(c.name,'') ilike '%ads%' or i.description ilike 'UNV Ads%' then 'UNV Ads'
                when coalesce(c.name,'') ilike '%social%' or i.description ilike 'UNV Social%' then 'UNV Social'
                else 'Principal' end linha,
           count(distinct i.company_id) q
      from company_invoices i
      left join staff_financial_cost_centers c on c.id = i.cost_center_id
     where i.status = 'paid' and i.paid_at is not null group by 1, 2
  )
  select jsonb_build_object(
    'meses', coalesce((select jsonb_agg(jsonb_build_object('ym', ym, 'r', rr, 'd', dd, 'qr', qr, 'qd', qd) order by ym) from meses), '[]'::jsonb),
    'anos', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'r', rr, 'd', dd, 'meses', com_dado, 'qr', qr, 'qd', qd) order by ano) from anos), '[]'::jsonb),
    'linhas', coalesce((select jsonb_agg(jsonb_build_object('ym', ym, 'linha', linha, 'r', rr, 'd', dd, 'qr', qr, 'qd', qd) order by ym, linha) from ml), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(jsonb_build_object('ym', ym, 'linha', linha, 'q', q) order by ym, linha) from cli), '[]'::jsonb),
    'fornecedores_linha', coalesce((select jsonb_agg(jsonb_build_object('linha', linha, 'cat', nome, 'v', v, 'n', n) order by linha, v desc) from fl), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'cat', nome, 'v', v) order by ano, v desc) from cat where v >= 3000), '[]'::jsonb),
    'centros', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'cat', nome, 'v', v) order by ano, v desc) from cc2 where v >= 3000), '[]'::jsonb),
    'fornecedores', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'cat', nome, 'v', v, 'n', n) order by ano, v desc) from forn), '[]'::jsonb)
  ) into saida;

  return saida;
end $function$;
