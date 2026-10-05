-- Sincronização automática do Meta Ads do CRM. Antes os dados (investimento,
-- leads, CPL) só atualizavam quando alguém clicava em Sincronizar na aba Tráfego
-- Pago: ficaram parados de 24/09 a 05/10 e o Painel de Controle, o CAC e o ROAS
-- mostravam o mês incompleto.
--
-- A função dispara a edge crm-meta-ads-sync pra cada conta conectada. A edge
-- grava crm_meta_ads_accounts.last_synced_at quando termina bem; se o acesso ao
-- Meta cair, last_synced_at para de andar e o painel alerta pela defasagem.
create or replace function public.crm_meta_ads_sync_all(p_days int default 3)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from crm_meta_ads_accounts where is_connected loop
    perform net.http_post(
      url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-meta-ads-sync',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('action', 'sync', 'account_id', r.id, 'days', greatest(1, least(coalesce(p_days, 3), 90))),
      timeout_milliseconds := 120000
    );
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.crm_meta_ads_sync_all(int) from public, anon, authenticated;
grant execute on function public.crm_meta_ads_sync_all(int) to service_role;

-- De 2 em 2 horas, os últimos 3 dias (o Meta ainda ajusta o dia corrente e o anterior).
select cron.unschedule(jobid) from cron.job where jobname in ('crm-meta-ads-sync-2h', 'crm-meta-ads-sync-diario');
select cron.schedule('crm-meta-ads-sync-2h', '7 */2 * * *', $$select public.crm_meta_ads_sync_all(3);$$);
-- Uma vez por dia (04:20 de Brasília), os últimos 35 dias, pra pegar ajuste de atribuição.
select cron.schedule('crm-meta-ads-sync-diario', '20 7 * * *', $$select public.crm_meta_ads_sync_all(35);$$);
