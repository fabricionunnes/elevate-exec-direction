-- Atualiza régua de cobranças: de diário para a cada hora (cron horário)
-- O filtro de horário agora é feito dentro da edge function por regra

-- Remove o job diário se existir
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('billing-notifications-daily', 'billing-notifications-hourly');

-- Cria o agendamento horário (roda no minuto 0 de cada hora)
SELECT cron.schedule(
  'billing-notifications-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/billing-notifications',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{"manual":false}'::jsonb
  ) AS request_id;
  $$
);
