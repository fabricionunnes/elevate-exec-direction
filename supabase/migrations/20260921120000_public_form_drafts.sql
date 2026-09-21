-- Formulários públicos: rascunho guardado no servidor enquanto o cliente preenche (21/09/2026)
create table if not exists public.public_form_drafts (
  form text not null, ref_id text not null, payload jsonb not null,
  step int, user_agent text, updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
  primary key (form, ref_id)
);
alter table public.public_form_drafts enable row level security;
revoke all on public.public_form_drafts from anon, authenticated;
grant all on public.public_form_drafts to service_role;
drop policy if exists public_form_drafts_staff_read on public.public_form_drafts;
create policy public_form_drafts_staff_read on public.public_form_drafts for select to authenticated using (get_current_staff_id() is not null);
grant select on public.public_form_drafts to authenticated;

create or replace function public.public_form_draft_save(p_form text, p_ref text, p_payload jsonb, p_step int default null, p_ua text default null)
returns boolean language plpgsql security definer set search_path to 'public' as $f$
begin
  if p_form is null or p_ref is null or p_payload is null then return false; end if;
  if p_form not in ('kickoff') then return false; end if;
  if length(p_payload::text) > 300000 then return false; end if;
  -- só aceita rascunho de empresa que existe
  if p_form = 'kickoff' and not exists (select 1 from onboarding_companies where id::text = p_ref) then return false; end if;
  insert into public_form_drafts (form, ref_id, payload, step, user_agent) values (p_form, left(p_ref,80), p_payload, p_step, left(p_ua,400))
  on conflict (form, ref_id) do update set payload = excluded.payload, step = excluded.step, user_agent = excluded.user_agent, updated_at = now();
  return true;
end $f$;
create or replace function public.public_form_draft_get(p_form text, p_ref text)
returns jsonb language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object('payload', payload, 'step', step, 'updated_at', updated_at) from public_form_drafts where form = p_form and ref_id = p_ref;
$f$;
create or replace function public.public_form_draft_clear(p_form text, p_ref text)
returns boolean language sql security definer set search_path to 'public' as $f$
  delete from public_form_drafts where form = p_form and ref_id = p_ref returning true;
$f$;
revoke all on function public.public_form_draft_save(text,text,jsonb,int,text) from public;
revoke all on function public.public_form_draft_get(text,text) from public;
revoke all on function public.public_form_draft_clear(text,text) from public;
grant execute on function public.public_form_draft_save(text,text,jsonb,int,text) to anon, authenticated, service_role;
grant execute on function public.public_form_draft_get(text,text) to anon, authenticated, service_role;
grant execute on function public.public_form_draft_clear(text,text) to anon, authenticated, service_role;
select 1;
