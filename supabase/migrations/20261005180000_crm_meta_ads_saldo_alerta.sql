-- Estado do aviso de saldo do Meta (o Marcelo avisa o Fabrício no WhatsApp):
-- nível do último aviso e quando saiu, pra não repetir a cada hora.
alter table public.crm_meta_ads_accounts
  add column if not exists balance_alert_level text,
  add column if not exists balance_alert_at timestamptz,
  add column if not exists daily_spend_avg numeric;
