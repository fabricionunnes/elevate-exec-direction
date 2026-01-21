
-- =============================================
-- DROP TABELAS PARCIALMENTE CRIADAS (se existirem)
-- =============================================
DROP TABLE IF EXISTS public.client_inventory_audit_log CASCADE;
DROP TABLE IF EXISTS public.client_inventory_settings CASCADE;
DROP TABLE IF EXISTS public.client_inventory_movements CASCADE;
DROP TABLE IF EXISTS public.client_inventory_sale_items CASCADE;
DROP TABLE IF EXISTS public.client_inventory_sales CASCADE;
DROP TABLE IF EXISTS public.client_inventory_budget_items CASCADE;
DROP TABLE IF EXISTS public.client_inventory_budgets CASCADE;
DROP TABLE IF EXISTS public.client_inventory_purchase_items CASCADE;
DROP TABLE IF EXISTS public.client_inventory_purchases CASCADE;
DROP TABLE IF EXISTS public.client_inventory_products CASCADE;
DROP TABLE IF EXISTS public.client_inventory_categories CASCADE;
DROP TABLE IF EXISTS public.client_inventory_suppliers CASCADE;

DROP FUNCTION IF EXISTS public.is_project_client(UUID);

-- =============================================
-- MÓDULO ESTOQUE & COMPRAS - ESTRUTURA COMPLETA
-- =============================================

-- 1) FORNECEDORES
CREATE TABLE public.client_inventory_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) CATEGORIAS DE PRODUTOS DE ESTOQUE
CREATE TABLE public.client_inventory_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) PRODUTOS DE ESTOQUE
CREATE TABLE public.client_inventory_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.client_inventory_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  base_unit TEXT NOT NULL DEFAULT 'UN',
  sale_unit TEXT,
  conversion_factor NUMERIC DEFAULT 1,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  average_cost NUMERIC DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  allow_fractional BOOLEAN DEFAULT false,
  allow_negative_stock BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) COMPRAS
CREATE TABLE public.client_inventory_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.client_inventory_suppliers(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  invoice_number TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  payable_id UUID REFERENCES public.client_financial_payables(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) ITENS DE COMPRA
CREATE TABLE public.client_inventory_purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.client_inventory_purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.client_inventory_products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) ORÇAMENTOS
CREATE TABLE public.client_inventory_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.client_inventory_suppliers(id) ON DELETE SET NULL,
  budget_date DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'negotiating' CHECK (status IN ('negotiating', 'approved', 'rejected', 'converted')),
  converted_purchase_id UUID REFERENCES public.client_inventory_purchases(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) ITENS DE ORÇAMENTO
CREATE TABLE public.client_inventory_budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.client_inventory_budgets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.client_inventory_products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  estimated_unit_cost NUMERIC NOT NULL,
  estimated_total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) VENDAS DE ESTOQUE
CREATE TABLE public.client_inventory_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_document TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  final_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  receivable_id UUID REFERENCES public.client_financial_receivables(id) ON DELETE SET NULL,
  total_cost NUMERIC DEFAULT 0,
  gross_profit NUMERIC DEFAULT 0,
  profit_margin NUMERIC DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9) ITENS DE VENDA
CREATE TABLE public.client_inventory_sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.client_inventory_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.client_inventory_products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  quantity_base NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10) MOVIMENTAÇÕES DE ESTOQUE
CREATE TABLE public.client_inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.client_inventory_products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'loss', 'return')),
  quantity NUMERIC NOT NULL,
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11) CONFIGURAÇÕES DO MÓDULO
CREATE TABLE public.client_inventory_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL UNIQUE REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  allow_negative_stock BOOLEAN DEFAULT false,
  alerts_enabled BOOLEAN DEFAULT true,
  purchase_category_id UUID REFERENCES public.client_financial_categories(id) ON DELETE SET NULL,
  sale_category_id UUID REFERENCES public.client_financial_categories(id) ON DELETE SET NULL,
  loss_category_id UUID REFERENCES public.client_financial_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12) LOG DE AUDITORIA
CREATE TABLE public.client_inventory_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  user_role TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_inventory_products_project ON public.client_inventory_products(project_id);
CREATE INDEX idx_inventory_products_category ON public.client_inventory_products(category_id);
CREATE INDEX idx_inventory_suppliers_project ON public.client_inventory_suppliers(project_id);
CREATE INDEX idx_inventory_purchases_project ON public.client_inventory_purchases(project_id);
CREATE INDEX idx_inventory_purchases_supplier ON public.client_inventory_purchases(supplier_id);
CREATE INDEX idx_inventory_sales_project ON public.client_inventory_sales(project_id);
CREATE INDEX idx_inventory_movements_project ON public.client_inventory_movements(project_id);
CREATE INDEX idx_inventory_movements_product ON public.client_inventory_movements(product_id);
CREATE INDEX idx_inventory_budgets_project ON public.client_inventory_budgets(project_id);

-- =============================================
-- TRIGGERS DE UPDATED_AT
-- =============================================
CREATE TRIGGER update_inventory_suppliers_updated_at BEFORE UPDATE ON public.client_inventory_suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_categories_updated_at BEFORE UPDATE ON public.client_inventory_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_products_updated_at BEFORE UPDATE ON public.client_inventory_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_purchases_updated_at BEFORE UPDATE ON public.client_inventory_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_budgets_updated_at BEFORE UPDATE ON public.client_inventory_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_sales_updated_at BEFORE UPDATE ON public.client_inventory_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_settings_updated_at BEFORE UPDATE ON public.client_inventory_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNÇÃO HELPER: VERIFICAR SE É CLIENTE DO PROJETO (role = 'client')
-- =============================================
CREATE OR REPLACE FUNCTION public.is_project_client(check_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_users
    WHERE project_id = check_project_id
    AND user_id = auth.uid()
    AND role = 'client'
  )
$$;

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE public.client_inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_inventory_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: SUPPLIERS
-- =============================================
CREATE POLICY "inventory_suppliers_select" ON public.client_inventory_suppliers
FOR SELECT USING (
  public.is_onboarding_admin() OR
  public.is_onboarding_assigned_staff(project_id) OR
  public.is_onboarding_project_member(project_id)
);
CREATE POLICY "inventory_suppliers_insert" ON public.client_inventory_suppliers
FOR INSERT WITH CHECK (public.is_project_client(project_id));
CREATE POLICY "inventory_suppliers_update" ON public.client_inventory_suppliers
FOR UPDATE USING (public.is_project_client(project_id));
CREATE POLICY "inventory_suppliers_delete" ON public.client_inventory_suppliers
FOR DELETE USING (public.is_project_client(project_id));

-- =============================================
-- RLS POLICIES: CATEGORIES
-- =============================================
CREATE POLICY "inventory_categories_select" ON public.client_inventory_categories
FOR SELECT USING (
  public.is_onboarding_admin() OR
  public.is_onboarding_assigned_staff(project_id) OR
  public.is_onboarding_project_member(project_id)
);
CREATE POLICY "inventory_categories_insert" ON public.client_inventory_categories
FOR INSERT WITH CHECK (public.is_project_client(project_id));
CREATE POLICY "inventory_categories_update" ON public.client_inventory_categories
FOR UPDATE USING (public.is_project_client(project_id));
CREATE POLICY "inventory_categories_delete" ON public.client_inventory_categories
FOR DELETE USING (public.is_project_client(project_id));

-- =============================================
-- RLS POLICIES: PRODUCTS
-- =============================================
CREATE POLICY "inventory_products_select" ON public.client_inventory_products
FOR SELECT USING (
  public.is_onboarding_admin() OR
  public.is_onboarding_assigned_staff(project_id) OR
  public.is_onboarding_project_member(project_id)
);
CREATE POLICY "inventory_products_insert" ON public.client_inventory_products
FOR INSERT WITH CHECK (public.is_project_client(project_id));
CREATE POLICY "inventory_products_update" ON public.client_inventory_products
FOR UPDATE USING (public.is_project_client(project_id));
CREATE POLICY "inventory_products_delete" ON public.client_inventory_products
FOR DELETE USING (public.is_project_client(project_id));

-- =============================================
-- RLS POLICIES: PURCHASES
-- =============================================
CREATE POLICY "inventory_purchases_select" ON public.client_inventory_purchases
FOR SELECT USING (
  public.is_onboarding_admin() OR
  public.is_onboarding_assigned_staff(project_id) OR
  public.is_onboarding_project_member(project_id)
);
CREATE POLICY "inventory_purchases_insert" ON public.client_inventory_purchases
FOR INSERT WITH CHECK (public.is_project_client(project_id));
CREATE POLICY "inventory_purchases_update" ON public.client_inventory_purchases
FOR UPDATE USING (public.is_project_client(project_id));
CREATE POLICY "inventory_purchases_delete" ON public.client_inventory_purchases
FOR DELETE USING (public.is_project_client(project_id));

-- =============================================
-- RLS POLICIES: PURCHASE ITEMS
-- =============================================
CREATE POLICY "inventory_purchase_items_select" ON public.client_inventory_purchase_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.client_inventory_purchases p
    WHERE p.id = purchase_id
    AND (public.is_onboarding_admin() OR public.is_onboarding_assigned_staff(p.project_id) OR public.is_onboarding_project_member(p.project_id))
  )
);
CREATE POLICY "inventory_purchase_items_insert" ON public.client_inventory_purchase_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_inventory_purchases p
    WHERE p.id = purchase_id AND public.is_project_client(p.project_id)
  )
);
CREATE POLICY "inventory_purchase_items_update" ON public.client_inventory_purchase_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.client_inventory_purchases p
    WHERE p.id = purchase_id AND public.is_project_client(p.project_id)
  )
);
CREATE POLICY "inventory_purchase_items_delete" ON public.client_inventory_purchase_items
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.client_inventory_purchases p
    WHERE p.id = purchase_id AND public.is_project_client(p.project_id)
  )
);

-- =============================================
-- RLS POLICIES: BUDGETS
-- =============================================
CREATE POLICY "inventory_budgets_select" ON public.client_inventory_budgets
FOR SELECT USING (
  public.is_onboarding_admin() OR
  public.is_onboarding_assigned_staff(project_id) OR
  public.is_onboarding_project_member(project_id)
);
CREATE POLICY "inventory_budgets_insert" ON public.client_inventory_budgets
FOR INSERT WITH CHECK (public.is_project_client(project_id));
CREATE POLICY "inventory_budgets_update" ON public.client_inventory_budgets
FOR UPDATE USING (public.is_project_client(project_id));
CREATE POLICY "inventory_budgets_delete" ON public.client_inventory_budgets
FOR DELETE USING (public.is_project_client(project_id));

-- =============================================
-- RLS POLICIES: BUDGET ITEMS
-- =============================================
CREATE POLICY "inventory_budget_items_select" ON public.client_inventory_budget_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.client_inventory_budgets b
    WHERE b.id = budget_id
    AND (public.is_onboarding_admin() OR public.is_onboarding_assigned_staff(b.project_id) OR public.is_onboarding_project_member(b.project_id))
  )
);
CREATE POLICY "inventory_budget_items_insert" ON public.client_inventory_budget_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_inventory_budgets b
    WHERE b.id = budget_id AND public.is_project_client(b.project_id)
  )
);
CREATE POLICY "inventory_budget_items_update" ON public.client_inventory_budget_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.client_inventory_budgets b
    WHERE b.id = budget_id AND public.is_project_client(b.project_id)
  )
);
CREATE POLICY "inventory_budget_items_delete" ON public.client_inventory_budget_items
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.client_inventory_budgets b
    WHERE b.id = budget_id AND public.is_project_client(b.project_id)
  )
);

-- =============================================
-- RLS POLICIES: SALES
-- =============================================
CREATE POLICY "inventory_sales_select" ON public.client_inventory_sales
FOR SELECT USING (
  public.is_onboarding_admin() OR
  public.is_onboarding_assigned_staff(project_id) OR
  public.is_onboarding_project_member(project_id)
);
CREATE POLICY "inventory_sales_insert" ON public.client_inventory_sales
FOR INSERT WITH CHECK (public.is_project_client(project_id));
CREATE POLICY "inventory_sales_update" ON public.client_inventory_sales
FOR UPDATE USING (public.is_project_client(project_id));
CREATE POLICY "inventory_sales_delete" ON public.client_inventory_sales
FOR DELETE USING (public.is_project_client(project_id));

-- =============================================
-- RLS POLICIES: SALE ITEMS
-- =============================================
CREATE POLICY "inventory_sale_items_select" ON public.client_inventory_sale_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.client_inventory_sales s
    WHERE s.id = sale_id
    AND (public.is_onboarding_admin() OR public.is_onboarding_assigned_staff(s.project_id) OR public.is_onboarding_project_member(s.project_id))
  )
);
CREATE POLICY "inventory_sale_items_insert" ON public.client_inventory_sale_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_inventory_sales s
    WHERE s.id = sale_id AND public.is_project_client(s.project_id)
  )
);
CREATE POLICY "inventory_sale_items_update" ON public.client_inventory_sale_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.client_inventory_sales s
    WHERE s.id = sale_id AND public.is_project_client(s.project_id)
  )
);
CREATE POLICY "inventory_sale_items_delete" ON public.client_inventory_sale_items
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.client_inventory_sales s
    WHERE s.id = sale_id AND public.is_project_client(s.project_id)
  )
);

-- =============================================
-- RLS POLICIES: MOVEMENTS
-- =============================================
CREATE POLICY "inventory_movements_select" ON public.client_inventory_movements
FOR SELECT USING (
  public.is_onboarding_admin() OR
  public.is_onboarding_assigned_staff(project_id) OR
  public.is_onboarding_project_member(project_id)
);
CREATE POLICY "inventory_movements_insert" ON public.client_inventory_movements
FOR INSERT WITH CHECK (public.is_project_client(project_id));

-- =============================================
-- RLS POLICIES: SETTINGS
-- =============================================
CREATE POLICY "inventory_settings_select" ON public.client_inventory_settings
FOR SELECT USING (
  public.is_onboarding_admin() OR
  public.is_onboarding_assigned_staff(project_id) OR
  public.is_onboarding_project_member(project_id)
);
CREATE POLICY "inventory_settings_insert" ON public.client_inventory_settings
FOR INSERT WITH CHECK (public.is_project_client(project_id));
CREATE POLICY "inventory_settings_update" ON public.client_inventory_settings
FOR UPDATE USING (public.is_project_client(project_id));

-- =============================================
-- RLS POLICIES: AUDIT LOG
-- =============================================
CREATE POLICY "inventory_audit_log_select" ON public.client_inventory_audit_log
FOR SELECT USING (
  public.is_onboarding_admin() OR
  public.is_onboarding_assigned_staff(project_id) OR
  public.is_onboarding_project_member(project_id)
);
CREATE POLICY "inventory_audit_log_insert" ON public.client_inventory_audit_log
FOR INSERT WITH CHECK (public.is_project_client(project_id));
