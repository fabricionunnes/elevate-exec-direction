-- Agenda asaas-sync para rodar diariamente às 06:00 UTC (03:00 BRT)
-- Garante que pagamentos confirmados no Asaas sem entrega de webhook sejam reconciliados

-- Remove agendamentos anteriores se existirem
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('asaas-sync-daily', 'asaas-sync-hourly');

-- Cron diário: reconcilia os últimos 7 dias de pagamentos no Asaas
SELECT cron.schedule(
  'asaas-sync-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/asaas-sync',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{"days":7}'::jsonb
  ) AS request_id;
  $$
);
