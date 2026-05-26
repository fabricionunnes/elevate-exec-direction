-- Agenda régua de cobranças: todo dia às 08:00 BRT (11:00 UTC)
-- Remove se já existir
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'billing-notifications-daily';

-- Cria o agendamento
SELECT cron.schedule(
  'billing-notifications-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/billing-notifications',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{"manual":false}'::jsonb
  ) AS request_id;
  $$
);
