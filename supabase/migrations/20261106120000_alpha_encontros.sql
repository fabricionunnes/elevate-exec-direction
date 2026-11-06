-- Mastermind Alpha: um registro por encontro mensal (datas, presença, ata e tarefas marcadas à mão).
-- As tarefas que dá para conferir pelos dados do projeto são calculadas na tela; aqui só ficam as manuais.
create table if not exists public.alpha_encontros (
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  data_presencial date,
  data_online date,
  presente_presencial boolean,
  presente_online boolean,
  tarefas jsonb not null default '{}'::jsonb,
  ata text,
  updated_at timestamptz not null default now(),
  primary key (project_id, ano, mes)
);

alter table public.alpha_encontros enable row level security;
drop policy if exists alpha_encontros_acesso on public.alpha_encontros;
create policy alpha_encontros_acesso on public.alpha_encontros for all to authenticated
  using (public.alpha_pode_ver(project_id)) with check (public.alpha_pode_ver(project_id));
grant select, insert, update, delete on public.alpha_encontros to authenticated;
grant all on public.alpha_encontros to service_role;

notify pgrst, 'reload schema';
