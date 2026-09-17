create table if not exists public.crm_whatsapp_ignored_chats (
  phone text primary key,
  name text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.crm_whatsapp_ignored_chats enable row level security;
drop policy if exists "staff gerencia ignorados" on public.crm_whatsapp_ignored_chats;
create policy "staff gerencia ignorados" on public.crm_whatsapp_ignored_chats for all to authenticated
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active))
  with check (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active and s.role in ('master','admin')));
grant select, insert, delete on public.crm_whatsapp_ignored_chats to authenticated;
grant all on public.crm_whatsapp_ignored_chats to service_role;
insert into public.crm_whatsapp_ignored_chats (phone, name) values
  ('120363409538763071','MyPromo #2'), ('120363028768109087','Pechinchou - 302')
on conflict (phone) do nothing;
notify pgrst, 'reload schema';
select json_agg(json_build_object('phone',phone,'name',name)) from crm_whatsapp_ignored_chats;
