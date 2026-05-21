-- Add asaas_payment_id to financial_receivables for automatic baixa integration
ALTER TABLE public.financial_receivables
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT DEFAULT NULL;

-- Index for fast lookup on webhook
CREATE INDEX IF NOT EXISTS idx_financial_receivables_asaas_payment_id
  ON public.financial_receivables(asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;
