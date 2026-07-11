-- Grafo do Cliente: rede de temas/pessoas/dores/decisões extraída pela IA de
-- tudo que o Nexus sabe do projeto (conversas de grupo, reuniões, tarefas,
-- briefing, grade, KPIs). Um jsonb por projeto, estilo client_brain.
create table if not exists project_graph (
  project_id uuid primary key references onboarding_projects(id) on delete cascade,
  graph jsonb not null,
  generated_at timestamptz not null default now()
);

alter table project_graph enable row level security;

drop policy if exists project_graph_staff on project_graph;
create policy project_graph_staff on project_graph for all
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active));

drop policy if exists project_graph_client on project_graph;
create policy project_graph_client on project_graph for select
  using (exists (
    select 1 from portal_users pu
    join onboarding_projects p on p.onboarding_company_id = pu.company_id
    where pu.user_id = auth.uid() and p.id = project_graph.project_id
  ));

-- Management API não herda default privileges: grants explícitos
grant select, insert, update, delete on project_graph to authenticated, service_role, anon;
