-- Reunião de cliente marcada direto no Google Agenda do consultor nasce ligada ao cliente no Nexus
-- (função reunioes-vincular-agenda, a cada 15 min). Pedido do Fabrício em 24/11/2026: "independente de
-- onde foi agendado, tem que vir o link do cliente".

-- o que cada rodada vinculou (ou vincularia, na simulação)
create table if not exists public.reunioes_vinculo_log (
  id uuid primary key default gen_random_uuid(),
  simulacao boolean not null default false,
  lidos integer,
  vinculadas integer,
  carimbadas integer,
  detalhes jsonb,
  erros jsonb,
  created_at timestamptz not null default now()
);
alter table public.reunioes_vinculo_log enable row level security;
revoke all on public.reunioes_vinculo_log from anon, authenticated;
grant all on public.reunioes_vinculo_log to service_role;
drop policy if exists "Equipe le o registro de vinculo de reunioes" on public.reunioes_vinculo_log;
create policy "Equipe le o registro de vinculo de reunioes" on public.reunioes_vinculo_log
  for select to authenticated using ((select public.gv_is_staff()));
grant select on public.reunioes_vinculo_log to authenticated;

-- Importação pela agenda não repete o aviso de "reunião agendada" pro consultor: o vigia da agenda
-- (google-calendar-watch) já avisou quando o evento nasceu no Google.
create or replace function public.notify_meeting_scheduled()
returns trigger
language plpgsql
security definer
as $function$
declare src text;
begin
  if current_setting('app.importando_agenda', true) = '1' then return new; end if;
  if TG_TABLE_NAME = 'crm_activities' then
    if new.type is distinct from 'meeting' then return new; end if;
    src := 'crm';
  else
    src := 'project';
  end if;
  begin
    perform net.http_post(
      url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/meeting-scheduled-notify',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('source', src, 'id', new.id),
      timeout_milliseconds := 8000
    );
  exception when others then
    raise warning 'notify_meeting_scheduled falhou: %', sqlerrm;
  end;
  return new;
end $function$;

create or replace function public.reunioes_importar_da_agenda(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_n integer;
begin
  perform set_config('app.importando_agenda', '1', true);
  insert into onboarding_meeting_notes (project_id, staff_id, google_event_id, meeting_title, meeting_date, subject, notes, meeting_link, is_finalized, calendar_owner_id, calendar_owner_name)
  select r.project_id, r.staff_id, r.google_event_id, r.meeting_title, r.meeting_date, r.subject, null, r.meeting_link, false, r.calendar_owner_id, r.calendar_owner_name
    from jsonb_to_recordset(p_rows) as r(project_id uuid, staff_id uuid, google_event_id text, meeting_title text, meeting_date timestamptz, subject text, meeting_link text, calendar_owner_id uuid, calendar_owner_name text)
   where not exists (select 1 from onboarding_meeting_notes m where m.google_event_id = r.google_event_id);
  get diagnostics v_n = row_count;
  return v_n;
end
$fn$;
revoke all on function public.reunioes_importar_da_agenda(jsonb) from public, anon, authenticated;
grant execute on function public.reunioes_importar_da_agenda(jsonb) to service_role;
