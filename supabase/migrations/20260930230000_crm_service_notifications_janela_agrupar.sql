-- Preferências de notificação do Atendimento: janela de horário e agrupamento.
-- notify_from / notify_until: só notificar dentro desse intervalo (hora local do
-- navegador). NULL nos dois = sempre. Intervalo pode cruzar a meia-noite.
-- group_minutes: uma notificação por conversa a cada X minutos (mensagens).
alter table public.crm_service_notifications
  add column if not exists notify_from time without time zone,
  add column if not exists notify_until time without time zone,
  add column if not exists group_minutes integer not null default 5;

alter table public.crm_service_notifications
  drop constraint if exists crm_service_notifications_group_minutes_check;
alter table public.crm_service_notifications
  add constraint crm_service_notifications_group_minutes_check check (group_minutes between 1 and 120);

comment on column public.crm_service_notifications.notify_from is 'Início da janela em que o usuário aceita ser notificado (hora local). NULL = sem limite.';
comment on column public.crm_service_notifications.notify_until is 'Fim da janela em que o usuário aceita ser notificado (hora local). NULL = sem limite.';
comment on column public.crm_service_notifications.group_minutes is 'Mensagens: no máximo uma notificação por conversa a cada X minutos.';
