alter table public.asaas_receipt_queue add column if not exists bank_transaction_id uuid;
create index if not exists asaas_receipt_queue_bank_tx_idx on public.asaas_receipt_queue(bank_transaction_id) where bank_transaction_id is not null;
select 'ok' as migrated;
