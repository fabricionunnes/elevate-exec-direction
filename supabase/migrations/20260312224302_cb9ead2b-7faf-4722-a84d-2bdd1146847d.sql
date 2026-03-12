
ALTER TABLE public.distratos
  ADD COLUMN pdf_url TEXT,
  ADD COLUMN zapsign_document_token TEXT,
  ADD COLUMN zapsign_document_url TEXT,
  ADD COLUMN zapsign_signers JSONB,
  ADD COLUMN zapsign_sent_at TIMESTAMP WITH TIME ZONE;
