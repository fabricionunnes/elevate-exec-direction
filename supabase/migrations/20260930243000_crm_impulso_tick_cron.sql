-- Cron do motor de impulsos (edge crm-impulso-tick), a cada minuto.
-- O segredo fica em app_secrets (key 'impulso_secret') e é o mesmo do secret
-- IMPULSO_SECRET da edge function. O cron só processa impulso que alguém criou e
-- iniciou: sem impulso rodando, a chamada volta vazia. "background": true faz a edge
-- responder na hora e trabalhar em segundo plano (um lote por impulso, sem loop longo).
select cron.unschedule(jobid) from cron.job where jobname = 'crm-impulso-tick';
select cron.schedule('crm-impulso-tick', '* * * * *', $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-impulso-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-impulso-secret', (select value from public.app_secrets where key = 'impulso_secret')),
    body := '{"background": true}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
