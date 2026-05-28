-- Agenda automações de reunião
-- sync-all-recordings: todo dia às 20:00 UTC (17:00 BRT) — sincroniza gravações do Drive,
--   transcreve, finaliza reunião e dispara resumo IA + geração de ações
-- check-pending-meetings: a cada hora — notifica reuniões passadas ainda não finalizadas

SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname IN ('sync-all-recordings-daily', 'check-pending-meetings-hourly');

SELECT cron.schedule(
  'sync-all-recordings-daily',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/sync-all-recordings',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'check-pending-meetings-hourly',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/check-pending-meetings',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
