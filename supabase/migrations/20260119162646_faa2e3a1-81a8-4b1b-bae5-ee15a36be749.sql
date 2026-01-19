-- =============================================
-- CLIENT FINANCIAL MODULE - Complete Schema
-- =============================================

-- 1) Financial Categories (for income and expenses)
CREATE TABLE public.client_financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, name, type)
);

-- 2) Cost Centers (optional)
CREATE TABLE public.client_financial_cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, name)
);

-- 3) Payment Methods
CREATE TABLE public.client_financial_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- 4) Accounts Receivable
CREATE TABLE public.client_financial_receivables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.client_financial_categories(id),
  cost_center_id UUID REFERENCES public.client_financial_cost_centers(id),
  amount DECIMAL(15,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue', 'cancelled')),
  payment_method_id UUID REFERENCES public.client_financial_payment_methods(id),
  paid_at DATE,
  paid_amount DECIMAL(15,2),
  notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 5) Accounts Payable
CREATE TABLE public.client_financial_payables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.client_financial_categories(id),
  cost_center_id UUID REFERENCES public.client_financial_cost_centers(id),
  amount DECIMAL(15,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue', 'cancelled')),
  payment_method_id UUID REFERENCES public.client_financial_payment_methods(id),
  paid_at DATE,
  paid_amount DECIMAL(15,2),
  notes TEXT,
  attachment_url TEXT,
  installment_number INTEGER,
  total_installments INTEGER,
  parent_id UUID REFERENCES public.client_financial_payables(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6) Recurring Rules (for recurring income/expenses)
CREATE TABLE public.client_financial_recurring_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  category_id UUID REFERENCES public.client_financial_categories(id),
  cost_center_id UUID REFERENCES public.client_financial_cost_centers(id),
  amount DECIMAL(15,2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  last_generated_date DATE,
  client_or_supplier_name TEXT,
  payment_method_id UUID REFERENCES public.client_financial_payment_methods(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 7) Audit Log
CREATE TABLE public.client_financial_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_role TEXT
);

-- 8) Cash Flow Snapshots (for performance)
CREATE TABLE public.client_financial_cashflow_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  opening_balance DECIMAL(15,2) DEFAULT 0,
  total_income DECIMAL(15,2) DEFAULT 0,
  total_expense DECIMAL(15,2) DEFAULT 0,
  closing_balance DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, snapshot_date)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_client_fin_receivables_project ON public.client_financial_receivables(project_id);
CREATE INDEX idx_client_fin_receivables_status ON public.client_financial_receivables(status);
CREATE INDEX idx_client_fin_receivables_due_date ON public.client_financial_receivables(due_date);
CREATE INDEX idx_client_fin_payables_project ON public.client_financial_payables(project_id);
CREATE INDEX idx_client_fin_payables_status ON public.client_financial_payables(status);
CREATE INDEX idx_client_fin_payables_due_date ON public.client_financial_payables(due_date);
CREATE INDEX idx_client_fin_recurring_project ON public.client_financial_recurring_rules(project_id);
CREATE INDEX idx_client_fin_audit_project ON public.client_financial_audit_log(project_id);
CREATE INDEX idx_client_fin_audit_record ON public.client_financial_audit_log(record_id);

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE public.client_financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_cashflow_snapshots ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - Read access for all authenticated users
-- =============================================

-- Categories - Read
CREATE POLICY "Anyone can view client financial categories"
ON public.client_financial_categories FOR SELECT
TO authenticated
USING (true);

-- Cost Centers - Read
CREATE POLICY "Anyone can view client financial cost centers"
ON public.client_financial_cost_centers FOR SELECT
TO authenticated
USING (true);

-- Payment Methods - Read
CREATE POLICY "Anyone can view client financial payment methods"
ON public.client_financial_payment_methods FOR SELECT
TO authenticated
USING (true);

-- Receivables - Read
CREATE POLICY "Anyone can view client financial receivables"
ON public.client_financial_receivables FOR SELECT
TO authenticated
USING (true);

-- Payables - Read
CREATE POLICY "Anyone can view client financial payables"
ON public.client_financial_payables FOR SELECT
TO authenticated
USING (true);

-- Recurring Rules - Read
CREATE POLICY "Anyone can view client financial recurring rules"
ON public.client_financial_recurring_rules FOR SELECT
TO authenticated
USING (true);

-- Audit Log - Read
CREATE POLICY "Anyone can view client financial audit log"
ON public.client_financial_audit_log FOR SELECT
TO authenticated
USING (true);

-- Cashflow Snapshots - Read
CREATE POLICY "Anyone can view client financial cashflow snapshots"
ON public.client_financial_cashflow_snapshots FOR SELECT
TO authenticated
USING (true);

-- =============================================
-- RLS POLICIES - Write access (will be controlled in app layer for client users)
-- =============================================

-- Categories - Write
CREATE POLICY "Authenticated users can insert client financial categories"
ON public.client_financial_categories FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client financial categories"
ON public.client_financial_categories FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client financial categories"
ON public.client_financial_categories FOR DELETE
TO authenticated
USING (true);

-- Cost Centers - Write
CREATE POLICY "Authenticated users can insert client financial cost centers"
ON public.client_financial_cost_centers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client financial cost centers"
ON public.client_financial_cost_centers FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client financial cost centers"
ON public.client_financial_cost_centers FOR DELETE
TO authenticated
USING (true);

-- Payment Methods - Write
CREATE POLICY "Authenticated users can insert client financial payment methods"
ON public.client_financial_payment_methods FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client financial payment methods"
ON public.client_financial_payment_methods FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client financial payment methods"
ON public.client_financial_payment_methods FOR DELETE
TO authenticated
USING (true);

-- Receivables - Write
CREATE POLICY "Authenticated users can insert client financial receivables"
ON public.client_financial_receivables FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client financial receivables"
ON public.client_financial_receivables FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client financial receivables"
ON public.client_financial_receivables FOR DELETE
TO authenticated
USING (true);

-- Payables - Write
CREATE POLICY "Authenticated users can insert client financial payables"
ON public.client_financial_payables FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client financial payables"
ON public.client_financial_payables FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client financial payables"
ON public.client_financial_payables FOR DELETE
TO authenticated
USING (true);

-- Recurring Rules - Write
CREATE POLICY "Authenticated users can insert client financial recurring rules"
ON public.client_financial_recurring_rules FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client financial recurring rules"
ON public.client_financial_recurring_rules FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client financial recurring rules"
ON public.client_financial_recurring_rules FOR DELETE
TO authenticated
USING (true);

-- Audit Log - Insert only
CREATE POLICY "Authenticated users can insert client financial audit log"
ON public.client_financial_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- Cashflow Snapshots - Write
CREATE POLICY "Authenticated users can insert client financial cashflow snapshots"
ON public.client_financial_cashflow_snapshots FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client financial cashflow snapshots"
ON public.client_financial_cashflow_snapshots FOR UPDATE
TO authenticated
USING (true);

-- =============================================
-- TRIGGERS for updated_at
-- =============================================
CREATE TRIGGER update_client_financial_categories_updated_at
BEFORE UPDATE ON public.client_financial_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_financial_cost_centers_updated_at
BEFORE UPDATE ON public.client_financial_cost_centers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_financial_receivables_updated_at
BEFORE UPDATE ON public.client_financial_receivables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_financial_payables_updated_at
BEFORE UPDATE ON public.client_financial_payables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_financial_recurring_rules_updated_at
BEFORE UPDATE ON public.client_financial_recurring_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTION to auto-update overdue status
-- =============================================
CREATE OR REPLACE FUNCTION public.update_client_financial_overdue_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update receivables
  UPDATE public.client_financial_receivables
  SET status = 'overdue'
  WHERE status = 'open' AND due_date < CURRENT_DATE;
  
  -- Update payables
  UPDATE public.client_financial_payables
  SET status = 'overdue'
  WHERE status = 'open' AND due_date < CURRENT_DATE;
END;
$$;