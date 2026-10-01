-- Listas de leads (benchmark Datacrazy): agrupar leads à mão, fora de funil e de etiqueta,
-- pra depois filtrar, exportar ou disparar em cima do grupo.
--  * crm_lead_lists: a lista (nome, descrição, cor, dono, compartilhada com o time).
--  * crm_lead_list_items: os leads da lista (um lead só entra uma vez em cada lista).
-- Quem vê: o dono, o time quando compartilhada, e master/admin (pra não sobrar lista órfã).
-- Quem renomeia e apaga: o dono ou master/admin. Colocar e tirar lead: quem vê a lista.

create table if not exists public.crm_lead_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  description text,
  color text,
  created_by uuid references public.onboarding_staff(id) on delete set null,
  tenant_id uuid,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.crm_lead_lists is 'Listas de leads do CRM (agrupamento manual).';
create index if not exists crm_lead_lists_owner_idx on public.crm_lead_lists (created_by);

create table if not exists public.crm_lead_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.crm_lead_lists(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  added_by uuid references public.onboarding_staff(id) on delete set null,
  added_at timestamptz not null default now(),
  constraint crm_lead_list_items_uq unique (list_id, lead_id)
);
create index if not exists crm_lead_list_items_lead_idx on public.crm_lead_list_items (lead_id);

create or replace function public.crm_lead_lists_fill()
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
      new.created_by := st.id;
      new.tenant_id := st.tenant_id;
    elsif new.created_by is not null then
      select s.tenant_id into new.tenant_id from onboarding_staff s where s.id = new.created_by;
    end if;
  else
    new.created_by := old.created_by;
    new.tenant_id := old.tenant_id;
    new.updated_at := now();
  end if;
  new.name := btrim(new.name);
  return new;
end $$;

drop trigger if exists trg_crm_lead_lists_fill on public.crm_lead_lists;
create trigger trg_crm_lead_lists_fill
  before insert or update on public.crm_lead_lists
  for each row execute function public.crm_lead_lists_fill();

create or replace function public.crm_lead_list_items_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.added_by := coalesce(get_current_staff_id(), new.added_by);
  return new;
end $$;

drop trigger if exists trg_crm_lead_list_items_fill on public.crm_lead_list_items;
create trigger trg_crm_lead_list_items_fill
  before insert on public.crm_lead_list_items
  for each row execute function public.crm_lead_list_items_fill();

alter table public.crm_lead_lists enable row level security;
alter table public.crm_lead_list_items enable row level security;
grant select, insert, update, delete on public.crm_lead_lists to authenticated, service_role;
grant select, insert, update, delete on public.crm_lead_list_items to authenticated, service_role;

drop policy if exists "Listas: ver as minhas, as compartilhadas e (admin) todas" on public.crm_lead_lists;
create policy "Listas: ver as minhas, as compartilhadas e (admin) todas" on public.crm_lead_lists
  for select to authenticated
  using (tenant_matches(tenant_id) and get_current_staff_id() is not null
    and (created_by = get_current_staff_id() or is_shared or is_crm_master_or_admin()));

drop policy if exists "Listas: criar" on public.crm_lead_lists;
create policy "Listas: criar" on public.crm_lead_lists
  for insert to authenticated
  with check (get_current_staff_id() is not null);

drop policy if exists "Listas: dono ou master/admin altera" on public.crm_lead_lists;
create policy "Listas: dono ou master/admin altera" on public.crm_lead_lists
  for update to authenticated
  using (tenant_matches(tenant_id) and (created_by = get_current_staff_id() or is_crm_master_or_admin()))
  with check (tenant_matches(tenant_id) and (created_by = get_current_staff_id() or is_crm_master_or_admin()));

drop policy if exists "Listas: dono ou master/admin apaga" on public.crm_lead_lists;
create policy "Listas: dono ou master/admin apaga" on public.crm_lead_lists
  for delete to authenticated
  using (tenant_matches(tenant_id) and (created_by = get_current_staff_id() or is_crm_master_or_admin()));

-- Itens: valem as regras da lista (a subconsulta passa pela RLS de crm_lead_lists) e,
-- pra incluir, o lead tem que ser um que a pessoa enxerga (RLS de crm_leads).
drop policy if exists "Itens: ver os das listas que enxergo" on public.crm_lead_list_items;
create policy "Itens: ver os das listas que enxergo" on public.crm_lead_list_items
  for select to authenticated
  using (list_id in (select l.id from public.crm_lead_lists l));

drop policy if exists "Itens: incluir em lista que enxergo" on public.crm_lead_list_items;
create policy "Itens: incluir em lista que enxergo" on public.crm_lead_list_items
  for insert to authenticated
  with check (list_id in (select l.id from public.crm_lead_lists l)
    and exists (select 1 from public.crm_leads x where x.id = lead_id));

drop policy if exists "Itens: tirar de lista que enxergo" on public.crm_lead_list_items;
create policy "Itens: tirar de lista que enxergo" on public.crm_lead_list_items
  for delete to authenticated
  using (list_id in (select l.id from public.crm_lead_lists l));

-- Listas que a pessoa enxerga, com a quantidade de leads contada no banco
-- (PostgREST corta em 1000 linhas; contar no front daria número errado).
create or replace function public.crm_lead_lists_overview()
returns table (
  id uuid, name text, description text, color text, created_by uuid, owner_name text,
  is_shared boolean, created_at timestamptz, lead_count bigint
)
language sql stable
set search_path = public
as $$
  select l.id, l.name, l.description, l.color, l.created_by, s.name, l.is_shared, l.created_at,
         (select count(*) from crm_lead_list_items i where i.list_id = l.id)
  from crm_lead_lists l
  left join onboarding_staff s on s.id = l.created_by
  order by lower(l.name);
$$;
grant execute on function public.crm_lead_lists_overview() to authenticated;
