
-- Banks table
CREATE TABLE public.financial_banks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  bank_code text,
  agency text,
  account_number text,
  initial_balance_cents bigint NOT NULL DEFAULT 0,
  current_balance_cents bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bank transactions ledger
CREATE TABLE public.financial_bank_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_id uuid NOT NULL REFERENCES public.financial_banks(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_cents bigint NOT NULL,
  description text,
  reference_type text, -- 'invoice' or 'payable'
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add bank_id to company_invoices for receivables
ALTER TABLE public.company_invoices ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES public.financial_banks(id);

-- Add bank_id to financial_payables for payables
ALTER TABLE public.financial_payables ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES public.financial_banks(id);

-- RLS
ALTER TABLE public.financial_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for financial_banks" ON public.financial_banks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for financial_bank_transactions" ON public.financial_bank_transactions FOR ALL USING (true) WITH CHECK (true);
