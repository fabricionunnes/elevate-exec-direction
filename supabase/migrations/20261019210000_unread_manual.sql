-- "Marcar como não lida" não ficava (Fabrício, 19/10/2026: "estou tendo que marcar 3x pra ficar").
-- O webhook do WhatsApp zera unread_count quando o celular manda chat lido (chats.update
-- unreadCount 0 / messages.update READ). A marcação manual passa a ter uma trava.
alter table public.crm_whatsapp_conversations add column if not exists unread_manual boolean not null default false;
alter table public.instagram_conversations add column if not exists unread_manual boolean not null default false;
