-- Uma só classificação de linha de negócio para o módulo inteiro.
-- O centro de custo da cobrança é o sinal mais forte e vem primeiro; a
-- descrição e o produto da empresa continuam valendo como antes, para o que
-- não tem centro de custo preenchido.
drop function if exists public.planejamento_fonte_receita(text, text);

create or replace function public.planejamento_fonte_receita(
  p_descricao text, p_produto text, p_centro text default null
) returns text
language sql immutable
as $function$
  select case
    when p_centro = 'UNV Ads' then 'receita_ads'
    when p_centro = 'UNV Social' then 'receita_social'
    when p_descricao ~* 'mastermind' then 'receita_mastermind'
    when p_descricao ~* 'mans(ã|a)o|imers(ã|a)o|mesa empreendedora|palestra|evento|ingresso' then 'receita_eventos'
    when p_descricao ~* 'unv social|social media' then 'receita_social'
    when p_descricao ~* 'unv ads|tr(á|a)fego' then 'receita_ads'
    when p_descricao ~* 'unv sales|crm|inst(â|a)ncia|cr(é|e)dito|m(ó|o)dulo' then 'receita_crm'
    when p_descricao ~* 'treinamento|in company|curso' then 'receita_treinamento'
    when p_produto = 'UNV Ads' then 'receita_ads'
    when p_produto = 'UNV Social' then 'receita_social'
    when p_produto in ('CRM', 'UNV Control', 'UNV Board', 'Time de IA',
                       'UNV AI Advisor', 'UNV AI Sales System') then 'receita_crm'
    else 'receita_consultoria'
  end
$function$;

-- O realizado do plano passa a considerar o centro de custo da cobrança, para
-- não divergir da aba Histórico: antes a mesma receita de Ads aparecia como
-- R$ 10.040 numa aba e R$ 12.350 na outra.
CREATE OR REPLACE FUNCTION public.planejamento_realizado_interno(p_ano integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ini date := make_date(p_ano, 1, 1);
  fim date := make_date(p_ano, 12, 31);
  out jsonb := '{}'::jsonb;
begin
  with
  -- produto principal de cada empresa, para classificar o que não tem pista na descrição
  prod as (
    select distinct on (company_id) company_id, product_name
      from onboarding_projects
     where product_name is not null
     order by company_id, created_at
  ),
  receita as (
    select planejamento_fonte_receita(coalesce(i.description, ''), p.product_name, cc.name) as fonte,
           extract(month from (i.paid_at at time zone 'America/Sao_Paulo'))::int as mes,
           coalesce(i.paid_amount_cents, i.amount_cents)::numeric / 100 as valor
      from company_invoices i
      left join prod p on p.company_id = i.company_id
      left join staff_financial_cost_centers cc on cc.id = i.cost_center_id
     where i.status = 'paid' and i.paid_at is not null
       and (i.paid_at at time zone 'America/Sao_Paulo')::date between ini and fim
    union all
    select planejamento_fonte_receita(coalesce(r.description, ''), p.product_name),
           extract(month from r.paid_date)::int,
           coalesce(r.paid_amount, r.amount)
      from financial_receivables r
      left join prod p on p.company_id = r.company_id
     where r.paid_date between ini and fim
       and r.tenant_id is null
  ),
  despesa as (
    select case
             when c.name = 'Comissões' then 'custo_comissao'
             when c.name = 'Imposto' or c.name ilike '%impostos sobre receita%' then 'custo_imposto'
             when c.name = 'Tráfego Pago' then 'custo_trafego'
             when c.dre_line = 'despesas_pessoal' then 'custo_pessoal'
             when c.dre_line = 'despesas_admin' then 'custo_admin'
             when c.dre_line = 'despesas_comerciais' then 'custo_comercial'
             when c.dre_line = 'despesas_financeiras' then 'custo_financeiro'
             when c.dre_line = 'investimentos' then 'custo_investimento'
             else 'custo_outros'
           end as fonte,
           extract(month from d.paid_date)::int as mes,
           coalesce(d.paid_amount, d.amount) as valor
      from financial_payables d
      left join staff_financial_categories c on c.id = d.category_id
     where d.status = 'paid' and d.paid_date between ini and fim
       and d.tenant_id is null
  ),
  -- clientes ativos no fim de cada mês do ano
  clientes as (
    select m.mes, 'qtd_clientes_ativos' as fonte,
           (select count(*) from onboarding_companies e
             where e.status = 'active'
               and e.created_at < (make_date(p_ano, m.mes, 1) + interval '1 month'))::numeric as valor
      from generate_series(1, 12) m(mes)
  ),
  tudo as (
    select fonte, mes, sum(valor) valor from receita group by 1, 2
    union all
    select fonte, mes, sum(valor) from despesa group by 1, 2
    union all
    select fonte, mes, valor from clientes
  )
  select coalesce(jsonb_object_agg(fonte, meses), '{}'::jsonb) into out
    from (
      select fonte, jsonb_object_agg(mes::text, round(valor, 2)) as meses
        from tudo
       where valor is not null
       group by fonte
    ) z;

  return out;
end $function$

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
    select to_char(r.paid_date,'YYYY-MM') ym, 'Principal'::text linha,
           coalesce(r.paid_amount, r.amount) rec, 0::numeric pag
      from financial_receivables r where r.tenant_id is null and r.paid_date is not null
    union all
    select to_char(i.paid_at,'YYYY-MM'),
           case planejamento_fonte_receita(coalesce(i.description,''), pr.product_name, c.name)
                when 'receita_ads' then 'UNV Ads'
                when 'receita_social' then 'UNV Social'
                else 'Principal' end,
           coalesce(i.paid_amount_cents, i.amount_cents)/100.0, 0
      from company_invoices i
      left join staff_financial_cost_centers c on c.id = i.cost_center_id
      left join (select distinct on (company_id) company_id, product_name from onboarding_projects
                  where product_name is not null order by company_id, created_at) pr
             on pr.company_id = i.company_id
     where i.status = 'paid' and i.paid_at is not null
    union all
    select to_char(p.paid_date,'YYYY-MM'),
           case when coalesce(nullif(trim(p.cost_center),''), cc.name, '') = 'UNV Ads' then 'UNV Ads'
                when coalesce(nullif(trim(p.cost_center),''), cc.name, '') = 'UNV Social' then 'UNV Social'
                else 'Principal' end,
           0, coalesce(p.paid_amount, p.amount)
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
           case planejamento_fonte_receita(coalesce(i.description,''), pr.product_name, c.name)
                when 'receita_ads' then 'UNV Ads'
                when 'receita_social' then 'UNV Social'
                else 'Principal' end linha,
           count(distinct i.company_id) q
      from company_invoices i
      left join staff_financial_cost_centers c on c.id = i.cost_center_id
      left join (select distinct on (company_id) company_id, product_name from onboarding_projects
                  where product_name is not null order by company_id, created_at) pr
             on pr.company_id = i.company_id
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
