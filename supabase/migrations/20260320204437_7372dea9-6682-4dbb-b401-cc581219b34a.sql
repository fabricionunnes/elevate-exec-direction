
-- Add contract form token to crm_leads for public access
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS contract_form_token text UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_crm_leads_contract_form_token 
  ON public.crm_leads (contract_form_token) 
  WHERE contract_form_token IS NOT NULL;

-- RLS policy: allow anonymous read of specific lead fields by token
CREATE POLICY "Public read lead by contract form token"
ON public.crm_leads
FOR SELECT
TO anon
USING (contract_form_token IS NOT NULL AND contract_form_token != '');

-- RLS policy: allow anonymous update of contract fields by token
CREATE POLICY "Public update lead contract data by token"
ON public.crm_leads
FOR UPDATE
TO anon
USING (contract_form_token IS NOT NULL AND contract_form_token != '')
WITH CHECK (contract_form_token IS NOT NULL AND contract_form_token != '');
