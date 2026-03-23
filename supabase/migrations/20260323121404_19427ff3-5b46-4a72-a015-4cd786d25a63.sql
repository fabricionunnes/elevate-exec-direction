
-- Employee contracts table
CREATE TABLE public.employee_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Staff reference
  staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  staff_name TEXT NOT NULL,
  staff_role TEXT NOT NULL,
  staff_email TEXT,
  staff_phone TEXT,
  staff_cpf TEXT,
  staff_cnpj TEXT,
  staff_address TEXT,
  
  -- Contract details
  contract_value NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'boleto',
  start_date DATE,
  duration_months INTEGER DEFAULT 3,
  
  -- Clauses snapshot (saves the state of all clauses at generation time)
  clauses_snapshot JSONB,
  
  -- PDF
  pdf_url TEXT,
  
  -- ZapSign integration
  zapsign_document_token TEXT,
  zapsign_document_url TEXT,
  zapsign_signers JSONB,
  zapsign_sent_at TIMESTAMPTZ,
  
  -- Created by
  created_by UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies: only admin/master staff can manage
CREATE POLICY "Staff admin can view employee contracts"
ON public.employee_contracts FOR SELECT TO authenticated
USING (public.is_onboarding_admin());

CREATE POLICY "Staff admin can insert employee contracts"
ON public.employee_contracts FOR INSERT TO authenticated
WITH CHECK (public.is_onboarding_admin());

CREATE POLICY "Staff admin can update employee contracts"
ON public.employee_contracts FOR UPDATE TO authenticated
USING (public.is_onboarding_admin())
WITH CHECK (public.is_onboarding_admin());

CREATE POLICY "Staff admin can delete employee contracts"
ON public.employee_contracts FOR DELETE TO authenticated
USING (public.is_onboarding_admin());

-- Updated_at trigger
CREATE TRIGGER update_employee_contracts_updated_at
  BEFORE UPDATE ON public.employee_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
