-- Fila de transcrição das gravações das reuniões do CRM.
-- O fechamento das 20h (crm-meetings-eod) põe a gravação do Drive em transcript_file_id;
-- a fase "collect" (cron a cada 10 min) manda pra AssemblyAI, guarda o job em
-- transcript_job_id, colhe o texto na aba Transcrição do lead e gera o briefing.
-- Antes a função esperava só 4 min pela AssemblyAI e desistia (reunião de 1h leva ~10 min),
-- e erro de saldo ficava mudo.
alter table public.crm_activities
  add column if not exists transcript_file_id text,
  add column if not exists transcript_job_id text,
  add column if not exists transcript_attempts int not null default 0,
  add column if not exists transcript_next_try_at timestamptz,
  add column if not exists transcript_error text;

create index if not exists crm_activities_fila_transcricao_idx
  on public.crm_activities (scheduled_at) where transcript_file_id is not null;

select cron.unschedule('crm-meetings-transcricao-fila')
where exists (select 1 from cron.job where jobname = 'crm-meetings-transcricao-fila');

select cron.schedule(
  'crm-meetings-transcricao-fila',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-meetings-eod?phase=collect',
    headers := (select jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || substring(command from 'Bearer ([A-Za-z0-9._-]+)')) from cron.job where jobid = 42),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
