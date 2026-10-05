-- Situação e saldo da conta de anúncios do Meta (preenchido pela edge
-- crm-meta-ads-balance). A conta UNV é pré-paga e zerou em 30/09/2026 sem
-- ninguém ser avisado.
alter table public.crm_meta_ads_accounts
  add column if not exists meta_account_status int,
  add column if not exists meta_account_status_label text,
  add column if not exists is_prepaid boolean,
  add column if not exists available_balance numeric,
  add column if not exists amount_owed numeric,
  add column if not exists funding_source text,
  add column if not exists currency text,
  add column if not exists balance_checked_at timestamptz,
  add column if not exists balance_error text;
