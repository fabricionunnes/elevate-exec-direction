-- Atendimento: apagar mensagem para todos (19/09/2026)
alter table public.crm_whatsapp_messages add column if not exists deleted_at timestamptz;
alter table public.crm_whatsapp_messages add column if not exists deleted_by uuid;
select 1;
