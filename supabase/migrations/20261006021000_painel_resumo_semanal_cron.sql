-- Resumo semanal do Painel de Controle no WhatsApp: toda segunda às 08:00 de
-- Brasília (11:00 UTC) o cron chama a edge painel-resumo-semanal, que manda o
-- texto pro telefone de ai_usage_config pelo número do Marcelo.
-- O segredo fica em app_secrets (key 'painel_resumo_secret'), o mesmo do secret
-- PAINEL_RESUMO_SECRET da edge.
--
-- ATENÇÃO: esta migration LIGA um envio automático de mensagem. Em 06/10/2026 ela
-- foi escrita e NÃO aplicada: só aplicar com o ok do Fabrício.
select cron.unschedule(jobid) from cron.job where jobname = 'painel-resumo-semanal';
select cron.schedule('painel-resumo-semanal', '0 11 * * 1', $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/painel-resumo-semanal',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-painel-resumo-secret', (select value from public.app_secrets where key = 'painel_resumo_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
