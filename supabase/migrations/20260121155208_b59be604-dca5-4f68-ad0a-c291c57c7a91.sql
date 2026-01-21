-- Create bank accounts table
CREATE TABLE public.client_financial_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_type TEXT DEFAULT 'checking',
  agency TEXT,
  account_number TEXT,
  initial_balance NUMERIC(15,2) DEFAULT 0,
  current_balance NUMERIC(15,2) DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.client_financial_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view bank accounts for their projects"
ON public.client_financial_bank_accounts FOR SELECT
USING (true);

CREATE POLICY "Users can insert bank accounts"
ON public.client_financial_bank_accounts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update bank accounts"
ON public.client_financial_bank_accounts FOR UPDATE
USING (true);

CREATE POLICY "Users can delete bank accounts"
ON public.client_financial_bank_accounts FOR DELETE
USING (true);

-- Add bank_account_id to receivables and payables
ALTER TABLE public.client_financial_receivables
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.client_financial_bank_accounts(id);

ALTER TABLE public.client_financial_payables
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.client_financial_bank_accounts(id);

-- Create bank transactions table to track all movements
CREATE TABLE public.client_financial_bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.client_financial_bank_accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'income', 'expense', 'transfer_in', 'transfer_out', 'adjustment'
  amount NUMERIC(15,2) NOT NULL,
  balance_before NUMERIC(15,2),
  balance_after NUMERIC(15,2),
  description TEXT,
  reference_type TEXT, -- 'receivable', 'payable', 'manual', 'transfer'
  reference_id UUID,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.client_financial_bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view bank transactions"
ON public.client_financial_bank_transactions FOR SELECT
USING (true);

CREATE POLICY "Users can insert bank transactions"
ON public.client_financial_bank_transactions FOR INSERT
WITH CHECK (true);

-- Trigger to update updated_at
CREATE TRIGGER update_client_financial_bank_accounts_updated_at
BEFORE UPDATE ON public.client_financial_bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();