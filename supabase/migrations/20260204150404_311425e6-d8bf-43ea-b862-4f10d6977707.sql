-- Add new closing fields to crm_leads table
ALTER TABLE crm_leads 
ADD COLUMN IF NOT EXISTS trade_name TEXT,          -- Nome Fantasia
ADD COLUMN IF NOT EXISTS zipcode TEXT,             -- CEP
ADD COLUMN IF NOT EXISTS installments TEXT,        -- Ex: "1+3" (entrada + parcelas)
ADD COLUMN IF NOT EXISTS due_day INTEGER,          -- Dia do vencimento (1-31)
ADD COLUMN IF NOT EXISTS payment_method TEXT;      -- PIX, Boleto, Cartão, etc.