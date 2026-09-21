-- Agenda do Fabrício: guardar a duração da reunião pra desenhar o bloco inteiro na grade (21/09/2026)
alter table public.onboarding_meeting_notes add column if not exists duration_minutes integer;
select 1;
