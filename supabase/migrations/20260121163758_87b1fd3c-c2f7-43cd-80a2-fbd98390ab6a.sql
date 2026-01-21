
-- =============================================
-- 1. CADASTRO DE CLIENTES
-- =============================================

-- Tabela principal de clientes
CREATE TABLE public.client_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  document_type TEXT DEFAULT 'cpf' CHECK (document_type IN ('cpf', 'cnpj')),
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  credit_limit NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para busca
CREATE INDEX idx_client_customers_project ON client_customers(project_id);
CREATE INDEX idx_client_customers_document ON client_customers(document);
CREATE INDEX idx_client_customers_name ON client_customers(name);

-- RLS
ALTER TABLE client_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client customers" ON client_customers
  FOR SELECT USING (true);

CREATE POLICY "Users can insert client customers" ON client_customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update client customers" ON client_customers
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete client customers" ON client_customers
  FOR DELETE USING (true);

-- Adicionar FK em vendas e receivables
ALTER TABLE client_inventory_sales 
  ADD COLUMN customer_id UUID REFERENCES client_customers(id);

ALTER TABLE client_financial_receivables 
  ADD COLUMN customer_id UUID REFERENCES client_customers(id);

-- =============================================
-- 2. SISTEMA DE ORÇAMENTOS DE VENDA
-- =============================================

CREATE TABLE public.client_sale_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES client_customers(id),
  customer_name TEXT,
  budget_number TEXT,
  budget_date DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date DATE,
  total_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  final_amount NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted', 'expired')),
  converted_sale_id UUID REFERENCES client_inventory_sales(id),
  seller_id UUID,
  seller_name TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.client_sale_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES client_sale_budgets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES client_inventory_products(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_client_sale_budgets_project ON client_sale_budgets(project_id);
CREATE INDEX idx_client_sale_budgets_customer ON client_sale_budgets(customer_id);
CREATE INDEX idx_client_sale_budget_items_budget ON client_sale_budget_items(budget_id);

-- RLS
ALTER TABLE client_sale_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sale_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sale budgets" ON client_sale_budgets
  FOR SELECT USING (true);

CREATE POLICY "Users can insert sale budgets" ON client_sale_budgets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update sale budgets" ON client_sale_budgets
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete sale budgets" ON client_sale_budgets
  FOR DELETE USING (true);

CREATE POLICY "Users can view sale budget items" ON client_sale_budget_items
  FOR SELECT USING (true);

CREATE POLICY "Users can insert sale budget items" ON client_sale_budget_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update sale budget items" ON client_sale_budget_items
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete sale budget items" ON client_sale_budget_items
  FOR DELETE USING (true);

-- =============================================
-- 3. PARCELAMENTO AUTOMÁTICO (Receivables)
-- =============================================

ALTER TABLE client_financial_receivables
  ADD COLUMN IF NOT EXISTS installment_number INTEGER,
  ADD COLUMN IF NOT EXISTS total_installments INTEGER,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES client_financial_receivables(id);

-- Índice para buscar parcelas de um mesmo parent
CREATE INDEX idx_receivables_parent ON client_financial_receivables(parent_id);

-- =============================================
-- 4. ALERTAS DE ESTOQUE MÍNIMO
-- =============================================

CREATE TABLE public.client_inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES client_inventory_products(id) ON DELETE CASCADE,
  alert_type TEXT DEFAULT 'low_stock' CHECK (alert_type IN ('low_stock', 'out_of_stock')),
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_inventory_alerts_project ON client_inventory_alerts(project_id);
CREATE INDEX idx_inventory_alerts_product ON client_inventory_alerts(product_id);
CREATE INDEX idx_inventory_alerts_unread ON client_inventory_alerts(project_id, is_read) WHERE is_read = false;

-- RLS
ALTER TABLE client_inventory_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory alerts" ON client_inventory_alerts
  FOR SELECT USING (true);

CREATE POLICY "Users can insert inventory alerts" ON client_inventory_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update inventory alerts" ON client_inventory_alerts
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete inventory alerts" ON client_inventory_alerts
  FOR DELETE USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_customers_updated_at
  BEFORE UPDATE ON client_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_sale_budgets_updated_at
  BEFORE UPDATE ON client_sale_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
