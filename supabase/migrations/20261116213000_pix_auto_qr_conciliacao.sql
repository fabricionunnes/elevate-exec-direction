-- Pix Automático: identificador de conciliação do QR da 1ª parcela (16/11/2026, caso Trilobit).
-- Quando o banco do cliente paga o QR como Pix comum, sem autorizar a recorrência, o Asaas manda o
-- pagamento sem pixAutomaticAuthorizationId, só com pixQrCodeId. Guardando o identificador do QR, o
-- asaas-webhook consegue ligar esse pagamento à autorização e dar baixa na 1ª parcela.
alter table public.asaas_pix_automatico add column if not exists qr_conciliacao text;
create index if not exists asaas_pix_automatico_qr_conciliacao on public.asaas_pix_automatico (qr_conciliacao) where qr_conciliacao is not null;
-- Trilobit: identificador que veio no evento de criação da autorização (log do recebedor)
update public.asaas_pix_automatico set qr_conciliacao = 'UNIVERSIDADEVENDAS00000743835092ASA'
 where id = '3cfd5c29-0e44-4a6d-8696-7b1d2a65a7b9' and qr_conciliacao is null;
select id, status, qr_conciliacao from public.asaas_pix_automatico where qr_conciliacao is not null;
