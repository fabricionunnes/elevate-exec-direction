-- Visões salvas do CRM (benchmark Datacrazy): o conjunto de filtros de uma tela guardado
-- com nome, pra reabrir com um clique. Vale pro funil (filtros + ordenação + kanban/tabela),
-- Contatos e Atendimento.
--  * crm_saved_views: a visão. Cada um vê as suas e as compartilhadas; só o dono (ou
--    master/admin, nas compartilhadas) altera e apaga.
--  * crm_saved_view_prefs: o que é de cada pessoa em cima de uma visão (fixada nos chips,
--    padrão ao abrir a tela). Fica separado porque uma visão compartilhada pode ser a
--    padrão de um e não de outro.

create table if not exists public.crm_saved_views (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.onboarding_staff(id) on delete cascade,
  tenant_id uuid,
  scope text not null check (scope in ('pipeline', 'contatos', 'atendimento')),
  name text not null check (length(btrim(name)) between 1 and 80),
  filters jsonb not null default '{}'::jsonb,
  -- só no escopo 'pipeline': funil a que a visão pertence (null = vale pra qualquer funil)
  pipeline_id uuid references public.crm_pipelines(id) on delete cascade,
  is_shared boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.crm_saved_views is 'Visões salvas do CRM: filtros de uma tela (funil, contatos, atendimento) guardados com nome.';
create index if not exists crm_saved_views_staff_idx on public.crm_saved_views (staff_id, scope);
create index if not exists crm_saved_views_shared_idx on public.crm_saved_views (scope) where is_shared;

create table if not exists public.crm_saved_view_prefs (
  staff_id uuid not null references public.onboarding_staff(id) on delete cascade,
  view_id uuid not null references public.crm_saved_views(id) on delete cascade,
  is_pinned boolean not null default false,
  is_default boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (staff_id, view_id)
);
comment on table public.crm_saved_view_prefs is 'Por pessoa: visão fixada nos chips e visão padrão (abre nela).';
create index if not exists crm_saved_view_prefs_view_idx on public.crm_saved_view_prefs (view_id);

-- Dono e tenant vêm de quem está logado; não mudam depois.
create or replace function public.crm_saved_views_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare st record;
begin
  if tg_op = 'INSERT' then
    select s.id, s.tenant_id into st from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1;
    if st.id is not null then
      new.staff_id := st.id;
      new.tenant_id := st.tenant_id;
    else
      -- service_role: usa o dono informado
      select s.tenant_id into new.tenant_id from onboarding_staff s where s.id = new.staff_id;
    end if;
  else
    new.staff_id := old.staff_id;
    new.tenant_id := old.tenant_id;
    new.scope := old.scope;
    new.updated_at := now();
  end if;
  new.name := btrim(new.name);
  return new;
end $$;

drop trigger if exists trg_crm_saved_views_fill on public.crm_saved_views;
create trigger trg_crm_saved_views_fill
  before insert or update on public.crm_saved_views
  for each row execute function public.crm_saved_views_fill();

alter table public.crm_saved_views enable row level security;
alter table public.crm_saved_view_prefs enable row level security;
grant select, insert, update, delete on public.crm_saved_views to authenticated, service_role;
grant select, insert, update, delete on public.crm_saved_view_prefs to authenticated, service_role;

drop policy if exists "Visoes: ver as minhas e as compartilhadas" on public.crm_saved_views;
create policy "Visoes: ver as minhas e as compartilhadas" on public.crm_saved_views
  for select to authenticated
  using (tenant_matches(tenant_id) and (staff_id = get_current_staff_id() or (is_shared and get_current_staff_id() is not null)));

drop policy if exists "Visoes: criar a minha" on public.crm_saved_views;
create policy "Visoes: criar a minha" on public.crm_saved_views
  for insert to authenticated
  with check (get_current_staff_id() is not null);

drop policy if exists "Visoes: dono ou master/admin altera" on public.crm_saved_views;
create policy "Visoes: dono ou master/admin altera" on public.crm_saved_views
  for update to authenticated
  using (tenant_matches(tenant_id) and (staff_id = get_current_staff_id() or (is_shared and is_crm_master_or_admin())))
  with check (tenant_matches(tenant_id) and (staff_id = get_current_staff_id() or is_crm_master_or_admin()));

drop policy if exists "Visoes: dono ou master/admin apaga" on public.crm_saved_views;
create policy "Visoes: dono ou master/admin apaga" on public.crm_saved_views
  for delete to authenticated
  using (tenant_matches(tenant_id) and (staff_id = get_current_staff_id() or (is_shared and is_crm_master_or_admin())));

drop policy if exists "Visoes prefs: so as minhas" on public.crm_saved_view_prefs;
create policy "Visoes prefs: so as minhas" on public.crm_saved_view_prefs
  for all to authenticated
  using (staff_id = get_current_staff_id())
  with check (staff_id = get_current_staff_id());

-- Define (ou tira) a visão padrão de quem está logado. Só pode haver uma padrão por tela
-- e, no funil, por funil: a anterior do mesmo contexto perde a marca.
create or replace function public.crm_saved_view_set_default(p_view uuid, p_on boolean default true)
returns void
language plpgsql
set search_path = public
as $$
declare v record; me uuid := get_current_staff_id();
begin
  if me is null then raise exception 'sem acesso ao CRM'; end if;
  select scope, pipeline_id into v from crm_saved_views where id = p_view;
  if not found then raise exception 'Visão não encontrada'; end if;

  update crm_saved_view_prefs p set is_default = false, updated_at = now()
  where p.staff_id = me and p.is_default
    and p.view_id in (
      select x.id from crm_saved_views x
      where x.scope = v.scope and x.pipeline_id is not distinct from v.pipeline_id
    );

  if p_on then
    insert into crm_saved_view_prefs (staff_id, view_id, is_default)
    values (me, p_view, true)
    on conflict (staff_id, view_id) do update set is_default = true, updated_at = now();
  end if;
end $$;
grant execute on function public.crm_saved_view_set_default(uuid, boolean) to authenticated;
