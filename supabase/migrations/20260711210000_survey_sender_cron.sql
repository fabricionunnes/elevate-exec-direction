-- Régua de pesquisas (NPS/CSAT) nunca teve agendamento: cria o cron diário
-- às 12:00 UTC (9h BRT). A função decide quem recebe pelas regras/frequência.
select cron.unschedule(jobid) from cron.job where jobname = 'survey-sender-daily';
select cron.schedule(
  'survey-sender-daily',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/survey-sender',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{"type":"all"}'::jsonb
  ) as request_id;
  $$
);
