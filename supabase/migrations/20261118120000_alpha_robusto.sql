-- Mastermind Alpha, versão robusta (18/11/2026): fechamento do mês, plano de ação,
-- negócios da mesa e o Capital do Próximo Salto. Só tabelas novas; nada existente muda.

-- Fechamento do mês: o dono confirma que os números do mês estão completos.
-- O prazo é o dia 10 do mês seguinte (critério do Capital do Próximo Salto).
create table if not exists public.alpha_fechamentos (
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  fechado_em timestamptz not null default now(),
  fechado_por uuid,
  observacao text,
  primary key (project_id, ano, mes)
);

-- Plano de ação: o que será feito para corrigir um desvio, com dono, prazo e impacto esperado.
create table if not exists public.alpha_acoes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  ano int not null,
  origem text,
  texto text not null,
  responsavel text,
  prazo date,
  impacto_mensal numeric,
  status text not null default 'aberta' check (status in ('aberta','andamento','feita','cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alpha_acoes_proj_idx on public.alpha_acoes (project_id, ano);

-- Negócios da mesa: o que o membro vendeu, comprou ou indicou dentro do grupo.
create table if not exists public.alpha_negocios (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  data date not null default current_date,
  tipo text not null default 'venda' check (tipo in ('venda','compra','indicacao','parceria')),
  com_quem text not null,
  descricao text,
  valor numeric not null default 0,
  status text not null default 'em_conversa' check (status in ('em_conversa','fechado','perdido')),
  created_at timestamptz not null default now()
);
create index if not exists alpha_negocios_proj_idx on public.alpha_negocios (project_id, data);

-- O próximo salto: o investimento que o membro escolhe em novembro e que recebe o Capital em dezembro.
create table if not exists public.alpha_saltos (
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  ano int not null,
  tipo text,
  descricao text,
  investimento_total numeric,
  retorno_esperado text,
  inicio date,
  updated_at timestamptz not null default now(),
  primary key (project_id, ano)
);

do $$
declare t text;
begin
  foreach t in array array['alpha_fechamentos','alpha_acoes','alpha_negocios','alpha_saltos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_acesso', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.alpha_pode_ver(project_id)) with check (public.alpha_pode_ver(project_id))', t || '_acesso', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Mensalidades em dia: o dono não lê a tabela de cobranças, então a conta sai por função.
-- Devolve só contagens da empresa do projeto, nunca as cobranças em si.
create or replace function public.alpha_capital(p_project uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_company uuid; v jsonb;
begin
  if not public.alpha_pode_ver(p_project) then
    raise exception 'sem acesso';
  end if;
  select onboarding_company_id into v_company from public.onboarding_projects where id = p_project;
  if v_company is null then
    return jsonb_build_object('atrasadas', 0, 'pagas', 0, 'abertas', 0);
  end if;
  select jsonb_build_object(
    'atrasadas', count(*) filter (where status = 'overdue' or (status = 'pending' and due_date < current_date)),
    'pagas', count(*) filter (where status = 'paid'),
    'abertas', count(*) filter (where status = 'pending' and due_date >= current_date))
  into v
  from public.company_invoices
  where company_id = v_company and due_date >= current_date - interval '13 months';
  return v;
end $$;
revoke all on function public.alpha_capital(uuid) from public, anon;
grant execute on function public.alpha_capital(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
