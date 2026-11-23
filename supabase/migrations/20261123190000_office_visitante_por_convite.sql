-- UNV Office: visitante entra por convite, sem login anônimo.
-- O login anônimo do projeto foi desligado em 23/11/2026. Quem quiser receber um
-- visitante continua gerando o convite no escritório; a função office-guest-enter
-- confere o convite e cria o acesso. Esta tabela registra cada entrada (limite por
-- convite e limpeza futura dos acessos de visitante).
create table if not exists public.office_guest_access (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.office_guest_invites(id) on delete cascade,
  user_id uuid not null,
  guest_name text,
  created_at timestamptz not null default now()
);
create index if not exists office_guest_access_invite_idx on public.office_guest_access (invite_id);
alter table public.office_guest_access enable row level security;
revoke all on public.office_guest_access from anon, authenticated;
grant all on public.office_guest_access to service_role;

-- Só a equipe ativa lê os convites (o visitante usa as funções office_validate_invite
-- e office_invite_info). A regra antiga deixava qualquer usuário logado ler os tokens.
drop policy if exists "guest_invites_select" on public.office_guest_invites;
