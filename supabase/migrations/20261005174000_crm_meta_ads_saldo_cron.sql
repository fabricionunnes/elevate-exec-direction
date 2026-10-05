-- Confere o saldo e a situação da conta do Meta de hora em hora. O segredo fica
-- em app_secrets (key 'meta_balance_secret'), o mesmo do secret da edge.
select cron.unschedule(jobid) from cron.job where jobname = 'crm-meta-ads-balance';
select cron.schedule('crm-meta-ads-balance', '12 * * * *', $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-meta-ads-balance',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-meta-balance-secret', (select value from public.app_secrets where key = 'meta_balance_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
