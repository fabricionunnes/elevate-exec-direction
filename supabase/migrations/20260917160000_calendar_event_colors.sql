-- Cor aplicada em cada reunião na agenda do Google (verde = realizada, vermelho = no-show).
-- Guarda o que já foi pintado pra função calendar-color-sync só tocar o que mudou.
create table if not exists public.calendar_event_colors (
  source text not null check (source in ('project','crm')),
  source_id uuid not null,
  event_id text not null,
  color text check (color in ('green','red')),
  meeting_at timestamptz,
  error text,
  applied_at timestamptz not null default now(),
  primary key (source, source_id)
);
create index if not exists calendar_event_colors_meeting_at_idx on public.calendar_event_colors (meeting_at);
alter table public.calendar_event_colors enable row level security;
revoke all on public.calendar_event_colors from anon, authenticated;
grant select, insert, update, delete on public.calendar_event_colors to service_role;
alter table public.calendar_event_colors drop constraint if exists calendar_event_colors_color_check;
alter table public.calendar_event_colors add constraint calendar_event_colors_color_check check (color in ('green','red','yellow'));
