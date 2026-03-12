-- Adicionar colunas de ajustes financeiros à tabela financial_receivables
ALTER TABLE public.financial_receivables
ADD COLUMN IF NOT EXISTS interest_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_fee_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT 0;