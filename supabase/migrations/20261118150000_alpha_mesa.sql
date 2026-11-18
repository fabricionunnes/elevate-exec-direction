-- Mastermind Alpha, a mesa de 60 (18/11/2026): uma cadeira por segmento, células de 10,
-- pedidos de indicação, um a um mensal entre membros e o placar de negócios do grupo.
-- Só tabelas e funções novas.

-- Ficha do membro na mesa: o segmento (uma cadeira por segmento), a célula e o que ele oferece.
create table if not exists public.alpha_membros (
  project_id uuid primary key references public.onboarding_projects(id) on delete cascade,
  segmento text,
  apresentacao text,
  cliente_ideal text,
  celula int check (celula between 1 and 12),
  updated_at timestamptz not null default now()
);

-- Pedido de indicação: quem o membro quer conhecer. A mesa inteira vê.
create table if not exists public.alpha_pedidos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  texto text not null,
  status text not null default 'aberto' check (status in ('aberto','atendido','encerrado')),
  created_at timestamptz not null default now()
);
create index if not exists alpha_pedidos_proj_idx on public.alpha_pedidos (project_id, created_at desc);

-- Um a um do mês: pares sorteados entre os membros. Sem acesso direto; só pelas funções.
create table if not exists public.alpha_pares (
  ano int not null,
  mes int not null check (mes between 1 and 12),
  project_a uuid not null references public.onboarding_projects(id) on delete cascade,
  project_b uuid not null references public.onboarding_projects(id) on delete cascade,
  feito_em timestamptz,
  primary key (ano, mes, project_a)
);
alter table public.alpha_pares enable row level security;
grant all on public.alpha_pares to service_role;

do $$
declare t text;
begin
  foreach t in array array['alpha_membros','alpha_pedidos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_acesso', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.alpha_pode_ver(project_id)) with check (public.alpha_pode_ver(project_id))', t || '_acesso', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Quem está na mesa: projetos ativos do Mastermind Alpha. Empresa de demonstração só aparece para ela mesma.
create or replace function public.alpha_projetos_da_mesa(p_project uuid)
returns table (project_id uuid, empresa text)
language sql stable security definer set search_path = public
as $$
  select p.id, c.name
  from public.onboarding_projects p
  join public.onboarding_companies c on c.id = p.onboarding_company_id
  where (p.product_id = 'mastermind-alpha' or p.product_name = 'UNV Mastermind Alpha')
    and p.status = 'active'
    and (coalesce(c.is_simulator, false) = false or p.id = p_project);
$$;
revoke all on function public.alpha_projetos_da_mesa(uuid) from public, anon, authenticated;
grant execute on function public.alpha_projetos_da_mesa(uuid) to service_role;

-- A mesa vista por um membro: os membros, os pedidos abertos, o par do mês e o placar do grupo.
-- Do grupo só saem nome da empresa, segmento, apresentação e totais. Nenhum número financeiro de outro membro.
create or replace function public.alpha_mesa(p_project uuid, p_ano int, p_mes int)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v jsonb;
begin
  if not public.alpha_pode_ver(p_project) then
    raise exception 'sem acesso';
  end if;
  select jsonb_build_object(
    'membros', coalesce((
      select jsonb_agg(jsonb_build_object('project_id', m.project_id, 'empresa', m.empresa, 'segmento', f.segmento,
               'apresentacao', f.apresentacao, 'cliente_ideal', f.cliente_ideal, 'celula', f.celula, 'eu', m.project_id = p_project)
             order by f.celula nulls last, m.empresa)
      from public.alpha_projetos_da_mesa(p_project) m left join public.alpha_membros f on f.project_id = m.project_id), '[]'::jsonb),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'empresa', m.empresa, 'texto', q.texto, 'status', q.status,
               'created_at', q.created_at, 'meu', q.project_id = p_project) order by q.created_at desc)
      from public.alpha_pedidos q join public.alpha_projetos_da_mesa(p_project) m on m.project_id = q.project_id
      where q.status = 'aberto' or q.project_id = p_project), '[]'::jsonb),
    'par', (
      select jsonb_build_object('empresa', m.empresa, 'segmento', f.segmento, 'apresentacao', f.apresentacao, 'feito_em', pr.feito_em)
      from public.alpha_pares pr
      join public.alpha_projetos_da_mesa(p_project) m
        on m.project_id = case when pr.project_a = p_project then pr.project_b else pr.project_a end
      left join public.alpha_membros f on f.project_id = m.project_id
      where pr.ano = p_ano and pr.mes = p_mes and (pr.project_a = p_project or pr.project_b = p_project)
      limit 1),
    'placar', (
      select jsonb_build_object(
        'ano', coalesce(sum(n.valor) filter (where n.status = 'fechado' and n.tipo <> 'compra'), 0),
        'mes', coalesce(sum(n.valor) filter (where n.status = 'fechado' and n.tipo <> 'compra' and extract(month from n.data) = p_mes), 0),
        'negocios', count(*) filter (where n.status = 'fechado' and n.tipo <> 'compra'),
        'em_conversa', coalesce(sum(n.valor) filter (where n.status = 'em_conversa' and n.tipo <> 'compra'), 0),
        'meu', coalesce(sum(n.valor) filter (where n.status = 'fechado' and n.tipo <> 'compra' and n.project_id = p_project), 0))
      from public.alpha_negocios n join public.alpha_projetos_da_mesa(p_project) m on m.project_id = n.project_id
      where extract(year from n.data) = p_ano)
  ) into v;
  return v;
end $$;
revoke all on function public.alpha_mesa(uuid, int, int) from public, anon;
grant execute on function public.alpha_mesa(uuid, int, int) to authenticated, service_role;

-- O membro marca que o um a um do mês aconteceu.
create or replace function public.alpha_par_feito(p_project uuid, p_ano int, p_mes int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.alpha_pode_ver(p_project) then
    raise exception 'sem acesso';
  end if;
  update public.alpha_pares set feito_em = now()
  where ano = p_ano and mes = p_mes and (project_a = p_project or project_b = p_project) and feito_em is null;
end $$;
revoke all on function public.alpha_par_feito(uuid, int, int) from public, anon;
grant execute on function public.alpha_par_feito(uuid, int, int) to authenticated, service_role;

-- Sorteio dos pares do mês (só o time da UNV). Refaz o sorteio do mês se já existir.
-- Com número ímpar de membros, um fica sem par no mês.
create or replace function public.alpha_sortear_pares(p_ano int, p_mes int)
returns int
language plpgsql security definer set search_path = public
as $$
declare ids uuid[]; i int; n int := 0;
begin
  if not public.is_staff_admin_or_master() then
    raise exception 'sem acesso';
  end if;
  delete from public.alpha_pares where ano = p_ano and mes = p_mes;
  select array_agg(p.id order by random()) into ids
  from public.onboarding_projects p join public.onboarding_companies c on c.id = p.onboarding_company_id
  where (p.product_id = 'mastermind-alpha' or p.product_name = 'UNV Mastermind Alpha') and p.status = 'active'
    and coalesce(c.is_simulator, false) = false;
  if ids is null then return 0; end if;
  i := 1;
  while i + 1 <= array_length(ids, 1) loop
    insert into public.alpha_pares (ano, mes, project_a, project_b) values (p_ano, p_mes, ids[i], ids[i + 1]);
    n := n + 1; i := i + 2;
  end loop;
  return n;
end $$;
revoke all on function public.alpha_sortear_pares(int, int) from public, anon;
grant execute on function public.alpha_sortear_pares(int, int) to authenticated, service_role;

notify pgrst, 'reload schema';
