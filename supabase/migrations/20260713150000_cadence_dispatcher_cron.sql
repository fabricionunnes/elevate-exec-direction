-- Central de Cadências nunca teve agendador: o crm-cadence-dispatcher foi
-- desenhado pra rodar a cada minuto (processa enrollments com next_run_at
-- vencido, respeitando janela de horário). Sem isso, cadência ativa com
-- leads inscritos não enviava NADA (21 inscrições morreram na fila).
select cron.unschedule(jobid) from cron.job where jobname = 'crm-cadence-dispatcher-minutely';
select cron.schedule(
  'crm-cadence-dispatcher-minutely',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-cadence-dispatcher',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{"cron":true}'::jsonb
  ) as request_id;
  $$
);
