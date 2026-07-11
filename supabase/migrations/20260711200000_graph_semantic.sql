-- Grafo real (nós/arestas normalizados) + busca semântica (pgvector) +
-- visibilidade por papel: master/admin veem todos os clientes; consultant só
-- os projetos dele (onboarding_projects.consultant_id); cliente vê o próprio.
create extension if not exists vector;

create table if not exists graph_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references onboarding_projects(id) on delete cascade,
  node_key text not null,
  label text not null,
  kind text not null,
  weight int not null default 3,
  resumo text,
  evidencias jsonb not null default '[]'::jsonb,
  embedding vector(1536),
  updated_at timestamptz not null default now(),
  unique (project_id, node_key)
);
create index if not exists idx_graph_nodes_project on graph_nodes(project_id);
create index if not exists idx_graph_nodes_embedding on graph_nodes
  using hnsw (embedding vector_cosine_ops);

create table if not exists graph_edges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references onboarding_projects(id) on delete cascade,
  source_key text not null,
  target_key text not null,
  weight int not null default 1,
  why text,
  unique (project_id, source_key, target_key)
);
create index if not exists idx_graph_edges_project on graph_edges(project_id);

-- ── Visibilidade: função única usada pelas policies ───────────────────────
create or replace function graph_project_visible(p_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    -- staff: master/admin veem tudo; consultant só os projetos dele
    exists (
      select 1 from onboarding_staff s
      where s.user_id = auth.uid() and s.is_active and (
        s.role in ('master','admin')
        or (s.role = 'consultant' and exists (
          select 1 from onboarding_projects p
          where p.id = p_project and p.consultant_id = s.id
        ))
      )
    )
    -- cliente do portal: só o projeto da empresa dele
    or exists (
      select 1 from portal_users pu
      join onboarding_projects p on p.onboarding_company_id = pu.company_id
      where pu.user_id = auth.uid() and p.id = p_project
    );
$$;

alter table graph_nodes enable row level security;
alter table graph_edges enable row level security;

drop policy if exists graph_nodes_read on graph_nodes;
create policy graph_nodes_read on graph_nodes for select
  using (graph_project_visible(project_id));
drop policy if exists graph_nodes_write on graph_nodes;
create policy graph_nodes_write on graph_nodes for all
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active and s.role in ('master','admin')));

drop policy if exists graph_edges_read on graph_edges;
create policy graph_edges_read on graph_edges for select
  using (graph_project_visible(project_id));
drop policy if exists graph_edges_write on graph_edges;
create policy graph_edges_write on graph_edges for all
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active and s.role in ('master','admin')));

grant select, insert, update, delete on graph_nodes, graph_edges to authenticated, service_role;

-- ── Busca semântica com ACL embutida (chamada pela edge function com o
--    auth.uid do chamador via RPC, ou pelo service role passando p_user) ───
create or replace function graph_semantic_search(
  p_embedding vector(1536),
  p_user uuid,
  p_project uuid default null,
  p_limit int default 15
)
returns table (
  project_id uuid,
  node_key text,
  label text,
  kind text,
  weight int,
  resumo text,
  evidencias jsonb,
  company_name text,
  similarity float
)
language sql stable security definer set search_path = public
as $$
  with me as (
    select s.id, s.role from onboarding_staff s
    where s.user_id = p_user and s.is_active
    limit 1
  ),
  visible as (
    select p.id, c.name company_name
    from onboarding_projects p
    left join onboarding_companies c on c.id = p.onboarding_company_id
    where (p_project is null or p.id = p_project)
      and exists (
        select 1 from me where me.role in ('master','admin')
          or (me.role = 'consultant' and p.consultant_id = me.id)
      )
  )
  select n.project_id, n.node_key, n.label, n.kind, n.weight, n.resumo, n.evidencias,
         v.company_name,
         1 - (n.embedding <=> p_embedding) as similarity
  from graph_nodes n
  join visible v on v.id = n.project_id
  where n.embedding is not null
  order by n.embedding <=> p_embedding
  limit p_limit;
$$;
