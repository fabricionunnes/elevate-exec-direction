-- Planejamento anual: planejado editável por linha e mês, comparado com o realizado
-- do próprio sistema. Serve qualquer ano; 2027 entra como primeiro.
--
-- O realizado segue exatamente as premissas do Painel de Controle: regime de caixa,
-- recebido = company_invoices status 'paid' por paid_at, pago = financial_payables
-- status 'paid' por paid_date, e sempre tenant_id nulo (white-label fica de fora).

create table if not exists planejamento_anos (
  ano           integer primary key,
  titulo        text not null,
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

create table if not exists planejamento_linhas (
  id            uuid primary key default gen_random_uuid(),
  ano           integer not null references planejamento_anos(ano) on delete cascade,
  grupo         text not null check (grupo in ('receita', 'custo', 'reserva', 'indicador')),
  linha         text not null,
  -- chave que casa com o realizado devolvido por planejamento_realizado(); nulo = linha só planejada
  fonte         text,
  unidade       text not null default 'brl' check (unidade in ('brl', 'qtd', 'pct')),
  ordem         integer not null default 0,
  -- 12 posições, janeiro a dezembro
  valores       numeric[] not null default array_fill(0::numeric, array[12]),
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint planejamento_linhas_12_meses check (array_length(valores, 1) = 12)
);

create index if not exists idx_planejamento_linhas_ano on planejamento_linhas (ano, grupo, ordem);

alter table planejamento_anos enable row level security;
alter table planejamento_linhas enable row level security;

drop policy if exists planejamento_anos_master on planejamento_anos;
create policy planejamento_anos_master on planejamento_anos
  for all to authenticated using (is_master()) with check (is_master());

drop policy if exists planejamento_linhas_master on planejamento_linhas;
create policy planejamento_linhas_master on planejamento_linhas
  for all to authenticated using (is_master()) with check (is_master());

grant select, insert, update, delete on planejamento_anos to authenticated;
grant select, insert, update, delete on planejamento_linhas to authenticated;

create or replace function planejamento_touch() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists trg_planejamento_anos_touch on planejamento_anos;
create trigger trg_planejamento_anos_touch before update on planejamento_anos
  for each row execute function planejamento_touch();

drop trigger if exists trg_planejamento_linhas_touch on planejamento_linhas;
create trigger trg_planejamento_linhas_touch before update on planejamento_linhas
  for each row execute function planejamento_touch();

------------------------------------------------------------------ realizado

-- A classificação de receita segue a mesma régua do DRE gerencial (FinancialDRETab):
-- primeiro a descrição, depois o produto da empresa; o que não casa é consultoria.
create or replace function planejamento_fonte_receita(p_descricao text, p_produto text)
returns text language sql immutable as $$
  select case
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
$$;

-- Devolve {"fonte": {"1": valor, ..., "12": valor}} para o ano pedido.
-- Receita e despesa em regime de caixa, que é o que o Fabrício acompanha.
create or replace function planejamento_realizado_interno(p_ano integer)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
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
    select planejamento_fonte_receita(coalesce(i.description, ''), p.product_name) as fonte,
           extract(month from (i.paid_at at time zone 'America/Sao_Paulo'))::int as mes,
           coalesce(i.paid_amount_cents, i.amount_cents)::numeric / 100 as valor
      from company_invoices i
      left join prod p on p.company_id = i.company_id
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
end $$;

create or replace function planejamento_realizado(p_ano integer)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not is_master() then
    raise exception 'sem permissão';
  end if;
  return planejamento_realizado_interno(p_ano);
end $$;

revoke all on function planejamento_realizado_interno(integer) from public, authenticated, anon;
grant execute on function planejamento_realizado(integer) to authenticated;
grant execute on function planejamento_fonte_receita(text, text) to authenticated;

-- Indicador de estoque (clientes na carteira) não soma os 12 meses: o total do
-- ano é o saldo de dezembro. Indicador de fluxo (contratos novos) soma.
alter table planejamento_linhas
  add column if not exists acumulacao text not null default 'soma'
  check (acumulacao in ('soma', 'ultimo'));

-- Linha que é percentual da receita (imposto, filantropia) não pode ficar parada
-- quando a receita muda na edição: senão o lucro na tela mente.
alter table planejamento_linhas
  add column if not exists formula text check (formula in ('pct_receita')),
  add column if not exists formula_pct numeric;
