-- Create table for storing generated contracts
CREATE TABLE public.generated_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Client info
  client_name TEXT NOT NULL,
  client_document TEXT NOT NULL,
  client_address TEXT,
  client_email TEXT,
  client_phone TEXT,
  
  -- Legal representative info
  legal_rep_name TEXT,
  legal_rep_cpf TEXT,
  legal_rep_rg TEXT,
  legal_rep_marital_status TEXT,
  legal_rep_nationality TEXT,
  legal_rep_profession TEXT,
  
  -- Contract details
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  contract_value NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  installments INTEGER,
  is_recurring BOOLEAN DEFAULT false,
  due_date DATE,
  start_date DATE,
  
  -- PDF storage
  pdf_url TEXT,
  
  -- Optional: link to company if saved to system
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.generated_contracts ENABLE ROW LEVEL SECURITY;

-- Allow public insert (for the public contract generator page)
CREATE POLICY "Anyone can insert contracts" 
ON public.generated_contracts 
FOR INSERT 
WITH CHECK (true);

-- Allow public select (for viewing history on public page)
CREATE POLICY "Anyone can view contracts" 
ON public.generated_contracts 
FOR SELECT 
USING (true);

-- Add index for faster lookups
CREATE INDEX idx_generated_contracts_created_at ON public.generated_contracts(created_at DESC);
CREATE INDEX idx_generated_contracts_client_name ON public.generated_contracts(client_name);