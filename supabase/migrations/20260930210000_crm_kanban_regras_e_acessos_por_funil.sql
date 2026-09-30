-- Kanban do CRM (benchmark Datacrazy, itens 6 e 7):
--  1. crm_activities.stage_action_id: liga a atividade automática à ação da etapa que a criou.
--     Sem isso não dá pra saber qual atividade OBRIGATÓRIA da etapa ainda está pendente
--     na hora de mover o lead (a trava de saída da etapa).
--  2. crm_stages.required_fields (text[], já existia e estava vazio) passa a guardar os
--     campos exigidos pra ENTRAR na etapa: coluna do lead ("phone", "email"...) ou
--     campo adicional ("custom:<id de crm_custom_fields>").
--  3. crm_pipeline_permissions: acesso por funil e por pessoa (staff_id null = todos).
--     Master/admin ignoram. Aplicado no front e, pra ver/criar/excluir, também no banco
--     (policies RESTRICTIVE em crm_leads, que só apertam quando existe linha configurada).

-- 1) vínculo atividade -> ação da etapa
alter table public.crm_activities
  add column if not exists stage_action_id uuid references public.crm_stage_actions(id) on delete set null;
create index if not exists crm_activities_lead_stage_action_idx
  on public.crm_activities (lead_id, stage_action_id) where stage_action_id is not null;

-- 2) documentação da coluna já existente
comment on column public.crm_stages.required_fields is
  'Campos exigidos pra entrar na etapa: coluna de crm_leads (phone, email, opportunity_value...) ou custom:<crm_custom_fields.id>';

-- 3) permissões por funil
create table if not exists public.crm_pipeline_permissions (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  staff_id uuid references public.onboarding_staff(id) on delete cascade,
  can_view boolean not null default true,
  can_create boolean not null default true,
  can_delete boolean not null default true,
  can_change_owner boolean not null default true,
  only_own_leads boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.crm_pipeline_permissions is 'Acesso por funil. staff_id null = regra pra todos; linha da pessoa tem prioridade sobre a de todos. Master/admin ignoram.';
create unique index if not exists crm_pipeline_permissions_uq
  on public.crm_pipeline_permissions (pipeline_id, coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists crm_pipeline_permissions_staff_idx on public.crm_pipeline_permissions (staff_id);

alter table public.crm_pipeline_permissions enable row level security;
grant select, insert, update, delete on public.crm_pipeline_permissions to authenticated, service_role;

-- só master/admin escrevem (head_comercial não)
create or replace function public.is_crm_master_or_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.onboarding_staff
    where user_id = auth.uid() and is_active = true and role in ('master', 'admin')
  )
$$;
grant execute on function public.is_crm_master_or_admin() to authenticated, service_role;

drop policy if exists "Staff CRM le acessos do funil" on public.crm_pipeline_permissions;
create policy "Staff CRM le acessos do funil" on public.crm_pipeline_permissions
  for select to authenticated
  using (has_crm_access() and (staff_id is null or staff_id = get_current_staff_id() or is_crm_admin()));
drop policy if exists "Master e admin gerenciam acessos do funil" on public.crm_pipeline_permissions;
create policy "Master e admin gerenciam acessos do funil" on public.crm_pipeline_permissions
  for all to authenticated
  using (is_crm_master_or_admin()) with check (is_crm_master_or_admin());

-- Regra efetiva do usuário logado pra um funil (linha da pessoa > linha de todos > liberado).
-- Quem não é staff (cliente do discador) e master/admin/head: sempre liberado.
create or replace function public.crm_pipeline_allows(p_pipeline uuid, p_kind text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when get_current_staff_id() is null or is_crm_admin() then true
    else coalesce((
      select case p_kind
        when 'view' then pp.can_view
        when 'create' then pp.can_create
        when 'delete' then pp.can_delete
        when 'change_owner' then pp.can_change_owner
        else true end
      from public.crm_pipeline_permissions pp
      where pp.pipeline_id = p_pipeline
        and (pp.staff_id = get_current_staff_id() or pp.staff_id is null)
      order by pp.staff_id nulls last
      limit 1
    ), true)
  end
$$;
grant execute on function public.crm_pipeline_allows(uuid, text) to authenticated, service_role;

-- Lead escondido pelo acesso do funil: funil sem visão, ou "só os meus" e o lead é de outro.
create or replace function public.crm_lead_hidden_by_pipeline(p_pipeline uuid, p_owner uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when get_current_staff_id() is null or is_crm_admin() then false
    else coalesce((
      select (not pp.can_view) or (pp.only_own_leads and p_owner is distinct from get_current_staff_id())
      from public.crm_pipeline_permissions pp
      where pp.pipeline_id = p_pipeline
        and (pp.staff_id = get_current_staff_id() or pp.staff_id is null)
      order by pp.staff_id nulls last
      limit 1
    ), false)
  end
$$;
grant execute on function public.crm_lead_hidden_by_pipeline(uuid, uuid) to authenticated, service_role;

-- Policies RESTRICTIVE: só apertam quando há linha em crm_pipeline_permissions pro funil.
drop policy if exists "Acesso por funil (ver)" on public.crm_leads;
create policy "Acesso por funil (ver)" on public.crm_leads
  as restrictive for select to authenticated
  using (not public.crm_lead_hidden_by_pipeline(pipeline_id, owner_staff_id));
drop policy if exists "Acesso por funil (criar)" on public.crm_leads;
create policy "Acesso por funil (criar)" on public.crm_leads
  as restrictive for insert to authenticated
  with check (public.crm_pipeline_allows(pipeline_id, 'create'));
drop policy if exists "Acesso por funil (excluir)" on public.crm_leads;
create policy "Acesso por funil (excluir)" on public.crm_leads
  as restrictive for delete to authenticated
  using (public.crm_pipeline_allows(pipeline_id, 'delete'));

-- Funil sem visão some da lista de funis também
drop policy if exists "Acesso por funil (lista)" on public.crm_pipelines;
create policy "Acesso por funil (lista)" on public.crm_pipelines
  as restrictive for select to authenticated
  using (public.crm_pipeline_allows(id, 'view'));
