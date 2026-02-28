
-- Add missing columns to client_financial_payables
ALTER TABLE public.client_financial_payables 
  ADD COLUMN IF NOT EXISTS competence_date date,
  ADD COLUMN IF NOT EXISTS expected_date date,
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS entity_identifier text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS recurrence_type text,
  ADD COLUMN IF NOT EXISTS recurrence_count integer,
  ADD COLUMN IF NOT EXISTS scheduled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS interest_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_expected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_expected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_expected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_number text;

-- Add missing columns to client_financial_receivables
ALTER TABLE public.client_financial_receivables 
  ADD COLUMN IF NOT EXISTS competence_date date,
  ADD COLUMN IF NOT EXISTS expected_date date,
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS entity_identifier text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS recurrence_type text,
  ADD COLUMN IF NOT EXISTS recurrence_count integer,
  ADD COLUMN IF NOT EXISTS scheduled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS interest_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_expected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_expected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_expected numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_number text;
