-- Atendimento (CRM): visibilidade GLOBAL por instância. Desligado = a instância
-- e as conversas dela somem do inbox pra todos (não afeta envio/automações).
-- Toggle na config Dispositivos (coluna ATENDIMENTO).
alter table whatsapp_instances add column if not exists show_in_inbox boolean not null default true;
alter table whatsapp_official_instances add column if not exists show_in_inbox boolean not null default true;
alter table instagram_instances add column if not exists show_in_inbox boolean not null default true;
