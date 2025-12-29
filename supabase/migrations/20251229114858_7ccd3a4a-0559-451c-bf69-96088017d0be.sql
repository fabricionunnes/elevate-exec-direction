-- Adicionar coluna para motivo do diagnóstico
ALTER TABLE public.client_diagnostics 
ADD COLUMN IF NOT EXISTS why_diagnostic TEXT;