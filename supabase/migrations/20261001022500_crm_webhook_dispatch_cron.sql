-- Cron dos webhooks de saída do CRM, 01/10/2026.
-- A cada minuto, e SÓ quando há algo pra entregar (ou linha presa em "sending"), chama a
-- edge crm-webhook-dispatch com o segredo de app_secrets. Fila vazia = nenhuma chamada.
select cron.unschedule('crm-webhook-dispatch') where exists (select 1 from cron.job where jobname = 'crm-webhook-dispatch');
select cron.schedule('crm-webhook-dispatch', '* * * * *', $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-webhook-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-dispatch-secret', (select value from public.app_secrets where key = 'crm_webhook_dispatch_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (
    select 1 from public.crm_outbound_webhook_deliveries
     where (status in ('pending', 'retrying') and next_retry_at <= now())
        or (status = 'sending' and last_attempt_at < now() - interval '5 minutes')
  );
$$);

-- Histórico de entregas: guarda 30 dias (limpeza diária às 03:20 de Brasília).
select cron.unschedule('crm-webhook-deliveries-cleanup') where exists (select 1 from cron.job where jobname = 'crm-webhook-deliveries-cleanup');
select cron.schedule('crm-webhook-deliveries-cleanup', '20 6 * * *', $$
  delete from public.crm_outbound_webhook_deliveries where created_at < now() - interval '30 days';
$$);
