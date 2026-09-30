-- Tipos de atividade configuráveis (Configurações do CRM > Tipos de Atividade).
-- Antes a lista era fixa em AddActivityDialog / EditActivityDialog / CRMActivitiesPage.
-- slug = valor gravado em crm_activities.type (estável; o código compara por ele,
-- ex. type = 'meeting'); name = rótulo mostrado. is_system trava exclusão dos
-- tipos que o código usa por valor.
create table if not exists public.crm_activity_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,
  color text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  constraint crm_activity_types_slug_check check (slug ~ '^[a-z0-9_]{1,40}$')
);

alter table public.crm_activity_types enable row level security;

drop policy if exists "Staff le tipos de atividade" on public.crm_activity_types;
create policy "Staff le tipos de atividade" on public.crm_activity_types
  for select to authenticated using (public.get_current_staff_id() is not null);

drop policy if exists "Admin gerencia tipos de atividade" on public.crm_activity_types;
create policy "Admin gerencia tipos de atividade" on public.crm_activity_types
  for all to authenticated using (public.crm_is_settings_admin()) with check (public.crm_is_settings_admin());

grant select, insert, update, delete on public.crm_activity_types to authenticated;
grant select on public.crm_activity_types to service_role;

-- Exclusão: nunca de tipo de sistema, nem de tipo com atividade usando.
create or replace function public.crm_activity_types_guard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_system then
    raise exception 'Tipo de sistema não pode ser excluído. Desative se não quiser usar.';
  end if;
  if exists (select 1 from public.crm_activities where type = old.slug limit 1) then
    raise exception 'Existem atividades com este tipo. Desative em vez de excluir.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_crm_activity_types_guard_delete on public.crm_activity_types;
create trigger trg_crm_activity_types_guard_delete
  before delete on public.crm_activity_types
  for each row execute function public.crm_activity_types_guard_delete();

-- Seed com os tipos que existem hoje (lista fixa do código + valores em crm_activities.type).
insert into public.crm_activity_types (slug, name, icon, color, sort_order, is_system) values
  ('call',       'Ligação',      'Phone',         '#2563eb', 1, true),
  ('whatsapp',   'WhatsApp',     'MessageSquare', '#16a34a', 2, true),
  ('email',      'E-mail',       'Mail',          '#7c3aed', 3, true),
  ('meeting',    'Reunião',      'Video',         '#ea580c', 4, true),
  ('followup',   'Follow-up',    'Repeat2',       '#0891b2', 5, true),
  ('proposal',   'Proposta',     'FileText',      '#ca8a04', 6, false),
  ('task',       'Tarefa',       'ListTodo',      '#475569', 7, true),
  ('note',       'Nota',         'StickyNote',    '#a16207', 8, true),
  ('video_call', 'Videochamada', 'Video',         '#db2777', 9, false),
  ('other',      'Outro',        'Calendar',      '#64748b', 10, false)
on conflict (slug) do nothing;
