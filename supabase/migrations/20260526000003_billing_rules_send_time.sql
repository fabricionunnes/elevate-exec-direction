-- Adiciona colunas de horário de envio por regra na régua de cobranças
ALTER TABLE public.billing_notification_rules
ADD COLUMN IF NOT EXISTS send_hour INTEGER NOT NULL DEFAULT 8 CHECK (send_hour >= 0 AND send_hour <= 23),
ADD COLUMN IF NOT EXISTS send_minute INTEGER NOT NULL DEFAULT 0 CHECK (send_minute >= 0 AND send_minute <= 59),
-- Coluna para timezone offset do cliente (padrão -3 = BRT)
ADD COLUMN IF NOT EXISTS timezone_offset INTEGER NOT NULL DEFAULT -3;
