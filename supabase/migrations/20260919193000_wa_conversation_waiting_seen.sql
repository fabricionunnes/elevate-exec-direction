-- Atendimento: abrir a conversa tira da fila Esperando resposta (19/09/2026)
alter table public.crm_whatsapp_conversations add column if not exists waiting_seen_at timestamptz;
select 1;
