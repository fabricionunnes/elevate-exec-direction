-- Fixar conversas no Atendimento (Fabrício, 19/10/2026: "quero poder fixar conversas se eu quiser").
-- Cada pessoa fixa as suas; fixada vai pro topo da lista.
create table if not exists public.crm_conversation_pins (
  staff_id uuid not null,
  conversation_id uuid not null,
  channel text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  primary key (staff_id, conversation_id, channel)
);
alter table public.crm_conversation_pins enable row level security;
drop policy if exists "pins: cada um os seus" on public.crm_conversation_pins;
create policy "pins: cada um os seus" on public.crm_conversation_pins
  for all to authenticated
  using (staff_id = (select get_current_staff_id()))
  with check (staff_id = (select get_current_staff_id()));
grant select, insert, delete on public.crm_conversation_pins to authenticated;
