
ALTER TABLE public.crm_notification_rules
ADD COLUMN stop_on_reply boolean NOT NULL DEFAULT false;

ALTER TABLE public.crm_notification_rule_messages
ADD COLUMN send_condition text NOT NULL DEFAULT 'always';

ALTER TABLE public.crm_notification_queue
ADD COLUMN cancelled_reason text;
