-- UNV Office, prédio fase 2 (Fabrício, 13/10/2026): "sala pra palestra, sala de reunião com cliente".
-- Térreo ganha o Auditório UNV (fileira norte central) e 3 salas de reunião com cliente
-- (Sala CRESCER, Sala Kart, Sala Nexus). Convite de visitante passa a reservar uma sala
-- de cliente (empresa/lead/projeto + horário) e o visitante entra direto nela.

-- 1) Tipos novos de sala. Se existir CHECK em room_type, ele é refeito com os 6 tipos.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class t on t.oid = con.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'office_team_rooms'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%room_type%'
  loop
    execute format('alter table public.office_team_rooms drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.office_team_rooms
  add constraint office_team_rooms_room_type_check
  check (room_type in ('sector', 'meeting', 'personal', 'lounge', 'auditorium', 'client'));

-- 2) Salas do térreo (fileira norte). Coordenadas conferidas contra BUILDING (-30..30 x -20..29)
--    e contra as salas que já existem (reuniões z 7, lounge x 19 z 7, pessoais z 17.4 e 25):
--    Auditório UNV   x 1,   z -11.5, 26 x 16 → x -12..14,  z -19.5..-3.5, porta S
--    Sala CRESCER    x -22, z -7,    12 x 9  → x -28..-16, z -11.5..-2.5, porta S
--    Sala Kart       x -22, z -16.5, 12 x 6  → x -28..-16, z -19.5..-13.5, porta S
--      (ajustada: na spec era z -16 / 12x7, que deixava só 1,0 de vão entre a Kart e a CRESCER
--       e o A* do auto-walk não passava; com 6 de fundo o vão fica com 2,0 e o caminho abre)
--    Sala Nexus      x 23,  z -7,    12 x 9  → x 17..29,   z -11.5..-2.5, porta S
insert into public.office_team_rooms (name, sector, room_type, x, z, width, depth, color, door_side, floor)
select 'Auditório UNV', null, 'auditorium', 1, -11.5, 26, 16, '#7a1a1a', 'S', 0
where not exists (select 1 from public.office_team_rooms where room_type = 'auditorium' and floor = 0);

insert into public.office_team_rooms (name, sector, room_type, x, z, width, depth, color, door_side, floor)
select 'Sala CRESCER', null, 'client', -22, -7, 12, 9, '#1B6B3A', 'S', 0
where not exists (select 1 from public.office_team_rooms where name = 'Sala CRESCER' and floor = 0);

insert into public.office_team_rooms (name, sector, room_type, x, z, width, depth, color, door_side, floor)
select 'Sala Kart', null, 'client', -22, -16.5, 12, 6, '#B85C00', 'S', 0
where not exists (select 1 from public.office_team_rooms where name = 'Sala Kart' and floor = 0);

insert into public.office_team_rooms (name, sector, room_type, x, z, width, depth, color, door_side, floor)
select 'Sala Nexus', null, 'client', 23, -7, 12, 9, '#1A4A8A', 'S', 0
where not exists (select 1 from public.office_team_rooms where name = 'Sala Nexus' and floor = 0);

-- Segurança: nenhuma sala de setor pode ter ficado no térreo (a fileira norte agora é do auditório)
update public.office_team_rooms set floor = 1 where room_type = 'sector' and floor = 0;

-- 3) Convite de visitante vira reserva de sala de cliente
alter table public.office_guest_invites add column if not exists room_id uuid references public.office_team_rooms(id) on delete set null;
alter table public.office_guest_invites add column if not exists lead_id uuid;
alter table public.office_guest_invites add column if not exists company_id uuid references public.onboarding_companies(id) on delete set null;
alter table public.office_guest_invites add column if not exists project_id uuid references public.onboarding_projects(id) on delete set null;
alter table public.office_guest_invites add column if not exists scheduled_at timestamptz;
alter table public.office_guest_invites add column if not exists guest_company text;
create index if not exists office_guest_invites_room_sched_idx on public.office_guest_invites (room_id, scheduled_at);

-- Staff ativo lê os convites (placa da porta + TV da sala). Insert continua só do master.
alter table public.office_guest_invites enable row level security;
drop policy if exists "office_guest_invites staff select" on public.office_guest_invites;
create policy "office_guest_invites staff select" on public.office_guest_invites
  for select to authenticated
  using (
    coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and exists (select 1 from public.onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true))
  );
grant select, insert on public.office_guest_invites to authenticated;

-- 4) Dados do convite pro visitante (login anônimo): sala, empresa e o token do painel do cliente.
--    Só devolve enquanto o convite vale; o token do painel só sai pra quem tem o token do convite.
create or replace function public.office_invite_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'room_id', i.room_id,
    'guest_company', i.guest_company,
    'scheduled_at', i.scheduled_at,
    'project_id', i.project_id,
    'dashboard_token', (select d.public_token from public.project_custom_dashboards d where d.project_id = i.project_id limit 1),
    'floor', r.floor,
    'x', r.x,
    'z', r.z,
    'room_type', r.room_type
  )
  from public.office_guest_invites i
  left join public.office_team_rooms r on r.id = i.room_id
  where p_token is not null and i.token = p_token and i.expires_at > now()
  limit 1
$$;
revoke all on function public.office_invite_info(text) from public;
grant execute on function public.office_invite_info(text) to anon, authenticated, service_role;
