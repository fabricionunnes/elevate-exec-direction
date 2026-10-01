-- O disparo das mensagens agendadas reserva a linha com status 'sending' antes
-- de enviar (pra duas execuções do cron não mandarem em dobro), mas o CHECK da
-- tabela só aceitava pending/sent/failed/cancelled e o envio real dava erro.
alter table public.crm_scheduled_messages drop constraint if exists crm_scheduled_messages_status_check;
alter table public.crm_scheduled_messages add constraint crm_scheduled_messages_status_check
  check (status = any (array['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]));
