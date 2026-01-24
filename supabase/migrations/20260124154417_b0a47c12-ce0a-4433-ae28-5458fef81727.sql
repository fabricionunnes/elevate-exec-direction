-- Add ZapSign tracking columns to generated_contracts table
ALTER TABLE public.generated_contracts 
ADD COLUMN IF NOT EXISTS zapsign_document_token TEXT,
ADD COLUMN IF NOT EXISTS zapsign_document_url TEXT,
ADD COLUMN IF NOT EXISTS zapsign_signers JSONB,
ADD COLUMN IF NOT EXISTS zapsign_sent_at TIMESTAMP WITH TIME ZONE;