-- UNV Mastermind Alpha: projeto do cliente focado em lucro líquido.
-- Plano anual, metas, participação de lucro trimestral e compromissos ficam nas tabelas alpha_*.
-- O realizado vem do financeiro do cliente (client_financial_receivables / payables), que é
-- alimentado pela integração com o sistema do cliente ou lançado no próprio Nexus.

-- grupo do DRE em cada categoria do financeiro do cliente
alter table public.client_financial_categories
  add column if not exists dre_grupo text
  check (dre_grupo is null or dre_grupo in
    ('receita','deducao','custo_variavel','pessoal','administrativa','comercial','financeiro','investimento','retirada'));

-- quem pode ver e editar o projeto Alpha: o dono (papel client), consultor/CS do projeto,
-- staff designado ou admin/master. Vendedor e gerente do cliente NÃO veem lucro nem DRE.
create or replace function public.alpha_pode_ver(p_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
           select 1 from public.onboarding_users ou
           where ou.project_id = p_project and ou.user_id = auth.uid()
             and ou.role in ('client', 'admin', 'cs', 'consultant'))
      or public.is_onboarding_assigned_staff(p_project)
      or public.is_staff_admin_or_master();
$$;
revoke all on function public.alpha_pode_ver(uuid) from public, anon;
grant execute on function public.alpha_pode_ver(uuid) to authenticated, service_role;

create table if not exists public.alpha_planos (
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  ano int not null,
  crescimento_pct numeric not null default 15,
  faturamento_ano_anterior numeric,
  lucro_ano_anterior numeric,
  reserva_caixa_alvo numeric not null default 0,
  pct_reinvestimento numeric not null default 20,
  saldo_caixa_inicial numeric not null default 0,
  observacoes text,
  updated_at timestamptz not null default now(),
  primary key (project_id, ano)
);

create table if not exists public.alpha_plano_meses (
  project_id uuid not null,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  receita numeric not null default 0,
  deducoes numeric not null default 0,
  custo_variavel numeric not null default 0,
  despesa_fixa numeric not null default 0,
  financeiro numeric not null default 0,
  investimento numeric not null default 0,
  primary key (project_id, ano, mes),
  foreign key (project_id, ano) references public.alpha_planos(project_id, ano) on delete cascade
);

create table if not exists public.alpha_metas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  ano int not null,
  mes int check (mes is null or mes between 1 and 12),
  nivel text not null check (nivel in ('empresa','produto','vendedor','indicador')),
  nome text not null,
  unidade text not null default 'brl' check (unidade in ('brl','qtd','pct')),
  meta numeric not null default 0,
  realizado numeric,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists alpha_metas_proj_idx on public.alpha_metas (project_id, ano, mes);

create table if not exists public.alpha_participacoes (
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  ano int not null,
  trimestre int not null check (trimestre between 1 and 4),
  lucro_apurado numeric,
  reserva numeric not null default 0,
  reinvestimento numeric not null default 0,
  distribuido numeric,
  status text not null default 'aberta' check (status in ('aberta','aprovada','paga')),
  pago_em date,
  observacao text,
  updated_at timestamptz not null default now(),
  primary key (project_id, ano, trimestre)
);

create table if not exists public.alpha_compromissos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  mes date not null,
  texto text not null,
  status text not null default 'aberto' check (status in ('aberto','cumprido','nao_cumprido')),
  created_at timestamptz not null default now()
);
create index if not exists alpha_compromissos_proj_idx on public.alpha_compromissos (project_id, mes);

-- RLS: mesma regra nas cinco tabelas
do $$
declare t text;
begin
  foreach t in array array['alpha_planos','alpha_plano_meses','alpha_metas','alpha_participacoes','alpha_compromissos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_acesso', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.alpha_pode_ver(project_id)) with check (public.alpha_pode_ver(project_id))', t || '_acesso', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Miolo do painel (sem trava; só service_role). Devolve plano, DRE por competência,
-- fluxo de caixa por pagamento, despesas por categoria, metas, participações e compromissos.
create or replace function public.alpha_painel_interno(p_project uuid, p_ano int)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_ini date := make_date(p_ano, 1, 1);
  v_fim date := make_date(p_ano, 12, 31);
  v_res jsonb;
begin
  with meses as (
    select generate_series(1, 12) as mes
  ),
  cat as (
    select id, name, coalesce(dre_grupo, case when type in ('income','receita','revenue') then 'receita' end) as grupo
    from client_financial_categories where project_id = p_project
  ),
  rec as (  -- contas a receber: competência pra DRE, pagamento pra caixa
    select r.amount, r.paid_amount, r.status, r.paid_at,
           coalesce(r.competence_date, r.due_date) as comp,
           coalesce(c.grupo, 'receita') as grupo
    from client_financial_receivables r left join cat c on c.id = r.category_id
    where r.project_id = p_project and coalesce(r.status, '') not in ('cancelled', 'canceled')
  ),
  pag as (
    select p.amount, p.paid_amount, p.status, p.paid_at,
           coalesce(p.competence_date, p.due_date) as comp,
           coalesce(c.grupo, 'sem_categoria') as grupo,
           coalesce(c.name, 'Sem categoria') as categoria
    from client_financial_payables p left join cat c on c.id = p.category_id
    where p.project_id = p_project and coalesce(p.status, '') not in ('cancelled', 'canceled')
  ),
  dre as (
    select m.mes,
      coalesce((select sum(case when rec.grupo = 'receita' then rec.amount else 0 end) from rec where rec.comp between v_ini and v_fim and extract(month from rec.comp) = m.mes), 0) as receita,
      coalesce((select sum(pag.amount) from pag where pag.grupo = 'deducao' and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as deducao,
      coalesce((select sum(pag.amount) from pag where pag.grupo = 'custo_variavel' and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as custo_variavel,
      coalesce((select sum(pag.amount) from pag where pag.grupo = 'pessoal' and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as pessoal,
      coalesce((select sum(pag.amount) from pag where pag.grupo = 'administrativa' and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as administrativa,
      coalesce((select sum(pag.amount) from pag where pag.grupo = 'comercial' and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as comercial,
      coalesce((select sum(pag.amount) from pag where pag.grupo = 'sem_categoria' and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as sem_categoria,
      coalesce((select sum(pag.amount) from pag where pag.grupo = 'financeiro' and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as financeiro,
      coalesce((select sum(pag.amount) from pag where pag.grupo = 'investimento' and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as investimento,
      coalesce((select sum(pag.amount) from pag where pag.grupo = 'retirada' and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as retirada,
      (select count(*) from rec where rec.comp between v_ini and v_fim and extract(month from rec.comp) = m.mes)
        + (select count(*) from pag where pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes) as lancamentos
    from meses m
  ),
  dfc as (
    select m.mes,
      coalesce((select sum(coalesce(rec.paid_amount, rec.amount)) from rec where rec.status in ('paid','partial') and rec.paid_at between v_ini and v_fim and extract(month from rec.paid_at) = m.mes), 0) as entradas,
      coalesce((select sum(coalesce(pag.paid_amount, pag.amount)) from pag where pag.status in ('paid','partial') and pag.grupo not in ('investimento','retirada','financeiro') and pag.paid_at between v_ini and v_fim and extract(month from pag.paid_at) = m.mes), 0) as saidas_operacionais,
      coalesce((select sum(coalesce(pag.paid_amount, pag.amount)) from pag where pag.status in ('paid','partial') and pag.grupo = 'financeiro' and pag.paid_at between v_ini and v_fim and extract(month from pag.paid_at) = m.mes), 0) as saidas_financeiras,
      coalesce((select sum(coalesce(pag.paid_amount, pag.amount)) from pag where pag.status in ('paid','partial') and pag.grupo = 'investimento' and pag.paid_at between v_ini and v_fim and extract(month from pag.paid_at) = m.mes), 0) as investimentos,
      coalesce((select sum(coalesce(pag.paid_amount, pag.amount)) from pag where pag.status in ('paid','partial') and pag.grupo = 'retirada' and pag.paid_at between v_ini and v_fim and extract(month from pag.paid_at) = m.mes), 0) as retiradas,
      coalesce((select sum(rec.amount) from rec where rec.status not in ('paid','partial') and rec.comp between v_ini and v_fim and extract(month from rec.comp) = m.mes), 0) as a_receber,
      coalesce((select sum(pag.amount) from pag where pag.status not in ('paid','partial') and pag.comp between v_ini and v_fim and extract(month from pag.comp) = m.mes), 0) as a_pagar
    from meses m
  )
  select jsonb_build_object(
    'ano', p_ano,
    'gerado_em', now(),
    'empresa', (select oc.name from onboarding_projects op left join onboarding_companies oc on oc.id = op.onboarding_company_id where op.id = p_project),
    'plano', (select to_jsonb(pl) - 'project_id' from alpha_planos pl where pl.project_id = p_project and pl.ano = p_ano),
    'plano_meses', coalesce((select jsonb_agg(to_jsonb(pm) - 'project_id' - 'ano' order by pm.mes) from alpha_plano_meses pm where pm.project_id = p_project and pm.ano = p_ano), '[]'::jsonb),
    'dre', (select jsonb_agg(to_jsonb(d) order by d.mes) from dre d),
    'dfc', (select jsonb_agg(to_jsonb(f) order by f.mes) from dfc f),
    'despesas_categoria', coalesce((
      select jsonb_agg(jsonb_build_object('categoria', categoria, 'grupo', grupo, 'valor', valor) order by valor desc)
      from (select categoria, grupo, sum(amount) valor from pag
            where comp between v_ini and v_fim and grupo not in ('retirada') group by 1, 2) x), '[]'::jsonb),
    'metas', coalesce((select jsonb_agg(to_jsonb(mt) - 'project_id' order by mt.mes nulls first, mt.ordem, mt.nome) from alpha_metas mt where mt.project_id = p_project and mt.ano = p_ano), '[]'::jsonb),
    'participacoes', coalesce((select jsonb_agg(to_jsonb(pa) - 'project_id' order by pa.trimestre) from alpha_participacoes pa where pa.project_id = p_project and pa.ano = p_ano), '[]'::jsonb),
    'compromissos', coalesce((select jsonb_agg(to_jsonb(co) - 'project_id' order by co.mes desc, co.created_at) from alpha_compromissos co where co.project_id = p_project and co.mes between v_ini and v_fim), '[]'::jsonb),
    'fonte', jsonb_build_object(
      'receber', (select count(*) from client_financial_receivables where project_id = p_project),
      'pagar', (select count(*) from client_financial_payables where project_id = p_project),
      'ultimo_lancamento', greatest(
        (select max(updated_at) from client_financial_receivables where project_id = p_project),
        (select max(updated_at) from client_financial_payables where project_id = p_project)),
      'origens', coalesce((select jsonb_object_agg(o, n) from (
        select coalesce(origin, 'manual') o, count(*) n from (
          select origin from client_financial_receivables where project_id = p_project
          union all select origin from client_financial_payables where project_id = p_project) u group by 1) z), '{}'::jsonb),
      'categorias_sem_grupo', (select count(*) from client_financial_categories where project_id = p_project and dre_grupo is null)
    )
  ) into v_res;
  return v_res;
end;
$$;
revoke all on function public.alpha_painel_interno(uuid, int) from public, anon, authenticated;
grant execute on function public.alpha_painel_interno(uuid, int) to service_role;

-- Wrapper com trava de acesso
create or replace function public.alpha_painel(p_project uuid, p_ano int)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.alpha_pode_ver(p_project) then
    raise exception 'sem acesso a este projeto';
  end if;
  return public.alpha_painel_interno(p_project, p_ano);
end;
$$;
revoke all on function public.alpha_painel(uuid, int) from public, anon;
grant execute on function public.alpha_painel(uuid, int) to authenticated;

notify pgrst, 'reload schema';
