-- 18/09/2026 — Formulário nativo do Meta (Lead Ads) caindo no CRM Comercial, com respostas e rastreamento avançado.
alter table public.crm_leads add column if not exists meta_lead_id text;
create unique index if not exists crm_leads_meta_lead_id_uniq on public.crm_leads (meta_lead_id) where meta_lead_id is not null;

-- respostas de formulário que não vêm de um formulário do Nexus: guarda o texto da pergunta
alter table public.crm_lead_form_answers alter column question_id drop not null;
alter table public.crm_lead_form_answers add column if not exists question_label text;
alter table public.crm_lead_form_answers add column if not exists source text;

create table if not exists public.crm_meta_lead_forms (
  form_id text primary key,
  form_name text,
  page_id text not null,
  page_name text,
  status text,
  leads_count int,
  is_active boolean not null default false,
  pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  stage_id uuid references public.crm_stages(id) on delete set null,
  origin_id uuid references public.crm_origins(id) on delete set null,
  tag_ids uuid[] not null default '{}',
  activated_at timestamptz,
  last_synced_at timestamptz,
  last_lead_time timestamptz,
  imported_count int not null default 0,
  last_result text,
  updated_at timestamptz not null default now()
);
alter table public.crm_meta_lead_forms enable row level security;
revoke all on public.crm_meta_lead_forms from anon;
grant select, update on public.crm_meta_lead_forms to authenticated;
grant all on public.crm_meta_lead_forms to service_role;
drop policy if exists crm_meta_lead_forms_read on public.crm_meta_lead_forms;
create policy crm_meta_lead_forms_read on public.crm_meta_lead_forms for select to authenticated using (get_current_staff_id() is not null);
drop policy if exists crm_meta_lead_forms_write on public.crm_meta_lead_forms;
create policy crm_meta_lead_forms_write on public.crm_meta_lead_forms for update to authenticated using (crm_is_settings_admin()) with check (crm_is_settings_admin());

create or replace function public.crm_meta_lead_forms_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.is_active and (not old.is_active or new.activated_at is null) then new.activated_at := now(); end if;
  return new;
end $$;
drop trigger if exists crm_meta_lead_forms_touch on public.crm_meta_lead_forms;
create trigger crm_meta_lead_forms_touch before update on public.crm_meta_lead_forms for each row execute function public.crm_meta_lead_forms_touch();

-- acha lead existente pelo telefone (mesma chave do vínculo de conversa), só leads da UNV (tenant nulo)
create or replace function public.crm_find_lead_by_phone(p_phone text) returns uuid language sql stable security definer set search_path = public as $$
  select l.id from crm_leads l where l.tenant_id is null and length(br_phone_key(p_phone)) = 10 and br_phone_key(l.phone) = br_phone_key(p_phone) order by l.created_at desc limit 1;
$$;
revoke all on function public.crm_find_lead_by_phone(text) from public, anon, authenticated;
grant execute on function public.crm_find_lead_by_phone(text) to service_role;
