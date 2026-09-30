-- Cron do disparo das mensagens agendadas (crm-scheduled-dispatch), a cada minuto.
-- O segredo fica em app_secrets (key 'scheduled_secret') e é o mesmo do secret
-- SCHEDULED_SECRET da edge function. NÃO foi aplicado automaticamente em 30/09/2026:
-- rodar à mão depois de conferir (é o que liga o envio real).
select cron.unschedule(jobid) from cron.job where jobname = 'crm-scheduled-dispatch';
select cron.schedule('crm-scheduled-dispatch', '* * * * *', $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-scheduled-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-scheduler-secret', (select value from public.app_secrets where key = 'scheduled_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
