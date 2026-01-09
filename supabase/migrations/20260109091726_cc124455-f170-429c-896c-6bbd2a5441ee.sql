-- ===========================================
-- MÓDULO FINANCEIRO COMPLETO - UNV NEXUS
-- ===========================================

-- 1) Contas Bancárias
CREATE TABLE public.financial_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  agency TEXT,
  account_type TEXT DEFAULT 'checking', -- checking, savings, investment
  initial_balance NUMERIC(15,2) DEFAULT 0,
  current_balance NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) Categorias Financeiras
CREATE TABLE public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- income, expense
  parent_id UUID REFERENCES public.financial_categories(id),
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3) Contratos Financeiros
CREATE TABLE public.financial_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  contract_name TEXT NOT NULL,
  contract_type TEXT DEFAULT 'recurring', -- recurring, one_time
  billing_cycle TEXT DEFAULT 'monthly', -- monthly, quarterly, semiannual, annual
  contract_value NUMERIC(15,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  payment_day INTEGER DEFAULT 10, -- dia do vencimento
  payment_method TEXT DEFAULT 'credit_card', -- credit_card, boleto, pix
  status TEXT DEFAULT 'active', -- active, paused, cancelled, ended
  notes TEXT,
  conta_azul_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4) Contas a Receber
CREATE TABLE public.financial_receivables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.financial_contracts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.financial_categories(id),
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  paid_amount NUMERIC(15,2),
  status TEXT DEFAULT 'pending', -- pending, paid, overdue, cancelled
  is_recurring BOOLEAN DEFAULT false,
  payment_method TEXT,
  payment_link TEXT,
  bank_account_id UUID REFERENCES public.financial_bank_accounts(id),
  notes TEXT,
  conta_azul_id TEXT,
  reference_month TEXT, -- formato: 2025-01
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5) Contas a Pagar
CREATE TABLE public.financial_payables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  category_id UUID REFERENCES public.financial_categories(id),
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  paid_amount NUMERIC(15,2),
  status TEXT DEFAULT 'pending', -- pending, paid, overdue, cancelled
  is_recurring BOOLEAN DEFAULT false,
  recurrence_type TEXT, -- monthly, quarterly, annual
  payment_method TEXT,
  bank_account_id UUID REFERENCES public.financial_bank_accounts(id),
  cost_center TEXT,
  notes TEXT,
  conta_azul_id TEXT,
  reference_month TEXT,
  installment_number INTEGER,
  total_installments INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6) Pagamentos Registrados
CREATE TABLE public.financial_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- receivable, payable
  reference_id UUID NOT NULL, -- ID do receivable ou payable
  amount NUMERIC(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  bank_account_id UUID REFERENCES public.financial_bank_accounts(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7) Movimentações Bancárias (Extrato)
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID REFERENCES public.financial_bank_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- credit, debit
  amount NUMERIC(15,2) NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.financial_categories(id),
  receivable_id UUID REFERENCES public.financial_receivables(id),
  payable_id UUID REFERENCES public.financial_payables(id),
  is_reconciled BOOLEAN DEFAULT false,
  balance_after NUMERIC(15,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8) Snapshots Financeiros (para histórico e relatórios)
CREATE TABLE public.financial_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  period_type TEXT NOT NULL, -- daily, monthly
  reference_month TEXT, -- 2025-01
  
  -- Receitas
  total_revenue NUMERIC(15,2) DEFAULT 0,
  mrr NUMERIC(15,2) DEFAULT 0,
  arr NUMERIC(15,2) DEFAULT 0,
  
  -- Custos e Despesas
  total_costs NUMERIC(15,2) DEFAULT 0,
  total_expenses NUMERIC(15,2) DEFAULT 0,
  fixed_costs NUMERIC(15,2) DEFAULT 0,
  variable_costs NUMERIC(15,2) DEFAULT 0,
  
  -- Resultados
  gross_profit NUMERIC(15,2) DEFAULT 0,
  ebitda NUMERIC(15,2) DEFAULT 0,
  net_profit NUMERIC(15,2) DEFAULT 0,
  
  -- Caixa
  total_cash NUMERIC(15,2) DEFAULT 0,
  receivables_pending NUMERIC(15,2) DEFAULT 0,
  payables_pending NUMERIC(15,2) DEFAULT 0,
  
  -- Métricas
  active_contracts INTEGER DEFAULT 0,
  new_contracts INTEGER DEFAULT 0,
  churned_contracts INTEGER DEFAULT 0,
  avg_ticket NUMERIC(15,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9) Insights da IA CFO
CREATE TABLE public.financial_cfo_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_type TEXT NOT NULL, -- alert, recommendation, analysis
  severity TEXT DEFAULT 'info', -- info, warning, critical
  category TEXT, -- revenue, costs, cash, churn, growth
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10) Orçamento / Planejamento
CREATE TABLE public.financial_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_month TEXT NOT NULL, -- 2025-01
  category_id UUID REFERENCES public.financial_categories(id),
  category_name TEXT, -- para casos sem categoria
  type TEXT NOT NULL, -- income, expense
  planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11) Configuração de Integrações
CREATE TABLE public.financial_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_type TEXT NOT NULL, -- conta_azul, bank_api
  is_active BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT, -- success, error, pending
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.financial_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cfo_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_integrations ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is financial admin (hardcoded email)
CREATE OR REPLACE FUNCTION public.is_financial_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'fabricio@universidadevendas.com.br'
  )
$$;

-- RLS Policies - ONLY for fabricio@universidadevendas.com.br
CREATE POLICY "Financial admin full access to bank_accounts"
ON public.financial_bank_accounts FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to categories"
ON public.financial_categories FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to contracts"
ON public.financial_contracts FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to receivables"
ON public.financial_receivables FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to payables"
ON public.financial_payables FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to payments"
ON public.financial_payments FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to transactions"
ON public.financial_transactions FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to snapshots"
ON public.financial_snapshots FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to cfo_insights"
ON public.financial_cfo_insights FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to budgets"
ON public.financial_budgets FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

CREATE POLICY "Financial admin full access to integrations"
ON public.financial_integrations FOR ALL
USING (public.is_financial_admin())
WITH CHECK (public.is_financial_admin());

-- Triggers for updated_at
CREATE TRIGGER update_financial_bank_accounts_updated_at
BEFORE UPDATE ON public.financial_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_contracts_updated_at
BEFORE UPDATE ON public.financial_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_receivables_updated_at
BEFORE UPDATE ON public.financial_receivables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_payables_updated_at
BEFORE UPDATE ON public.financial_payables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_budgets_updated_at
BEFORE UPDATE ON public.financial_budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_integrations_updated_at
BEFORE UPDATE ON public.financial_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.financial_categories (name, type, color, icon, sort_order) VALUES
-- Income categories
('Mensalidades', 'income', '#10b981', 'repeat', 1),
('Projetos Avulsos', 'income', '#3b82f6', 'briefcase', 2),
('Consultorias', 'income', '#8b5cf6', 'users', 3),
('Treinamentos', 'income', '#f59e0b', 'graduation-cap', 4),
('Outros Receitas', 'income', '#6b7280', 'plus-circle', 5),

-- Expense categories
('Salários e Encargos', 'expense', '#ef4444', 'users', 10),
('Ferramentas e Software', 'expense', '#f97316', 'wrench', 11),
('Marketing e Anúncios', 'expense', '#ec4899', 'megaphone', 12),
('Infraestrutura', 'expense', '#14b8a6', 'building', 13),
('Impostos e Taxas', 'expense', '#64748b', 'receipt', 14),
('Comissões', 'expense', '#a855f7', 'percent', 15),
('Serviços Terceirizados', 'expense', '#06b6d4', 'handshake', 16),
('Viagens e Deslocamento', 'expense', '#84cc16', 'car', 17),
('Outros Despesas', 'expense', '#6b7280', 'minus-circle', 18);

-- Create index for performance
CREATE INDEX idx_financial_receivables_status ON public.financial_receivables(status);
CREATE INDEX idx_financial_receivables_due_date ON public.financial_receivables(due_date);
CREATE INDEX idx_financial_receivables_company ON public.financial_receivables(company_id);
CREATE INDEX idx_financial_payables_status ON public.financial_payables(status);
CREATE INDEX idx_financial_payables_due_date ON public.financial_payables(due_date);
CREATE INDEX idx_financial_contracts_company ON public.financial_contracts(company_id);
CREATE INDEX idx_financial_contracts_status ON public.financial_contracts(status);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(transaction_date);
CREATE INDEX idx_financial_snapshots_month ON public.financial_snapshots(reference_month);