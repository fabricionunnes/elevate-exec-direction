-- Create table for client products/services
CREATE TABLE public.client_financial_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  category_id UUID REFERENCES public.client_financial_categories(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create table for client sales
CREATE TABLE public.client_financial_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT,
  salesperson_id UUID REFERENCES public.company_salespeople(id),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  payment_method_id UUID REFERENCES public.client_financial_payment_methods(id),
  notes TEXT,
  receivable_id UUID REFERENCES public.client_financial_receivables(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create table for sale items (products in each sale)
CREATE TABLE public.client_financial_sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.client_financial_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.client_financial_products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  cost_price NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.client_financial_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_sale_items ENABLE ROW LEVEL SECURITY;

-- Policies for client_financial_products
CREATE POLICY "Users can view products for their projects"
  ON public.client_financial_products
  FOR SELECT
  USING (
    public.is_onboarding_project_member(project_id)
    OR public.is_onboarding_assigned_staff(project_id)
    OR public.is_onboarding_admin()
  );

CREATE POLICY "Users can insert products for their projects"
  ON public.client_financial_products
  FOR INSERT
  WITH CHECK (
    public.is_onboarding_project_member(project_id)
    OR public.is_onboarding_assigned_staff(project_id)
    OR public.is_onboarding_admin()
  );

CREATE POLICY "Users can update products for their projects"
  ON public.client_financial_products
  FOR UPDATE
  USING (
    public.is_onboarding_project_member(project_id)
    OR public.is_onboarding_assigned_staff(project_id)
    OR public.is_onboarding_admin()
  );

CREATE POLICY "Users can delete products for their projects"
  ON public.client_financial_products
  FOR DELETE
  USING (
    public.is_onboarding_project_member(project_id)
    OR public.is_onboarding_assigned_staff(project_id)
    OR public.is_onboarding_admin()
  );

-- Policies for client_financial_sales
CREATE POLICY "Users can view sales for their projects"
  ON public.client_financial_sales
  FOR SELECT
  USING (
    public.is_onboarding_project_member(project_id)
    OR public.is_onboarding_assigned_staff(project_id)
    OR public.is_onboarding_admin()
  );

CREATE POLICY "Users can insert sales for their projects"
  ON public.client_financial_sales
  FOR INSERT
  WITH CHECK (
    public.is_onboarding_project_member(project_id)
    OR public.is_onboarding_assigned_staff(project_id)
    OR public.is_onboarding_admin()
  );

CREATE POLICY "Users can update sales for their projects"
  ON public.client_financial_sales
  FOR UPDATE
  USING (
    public.is_onboarding_project_member(project_id)
    OR public.is_onboarding_assigned_staff(project_id)
    OR public.is_onboarding_admin()
  );

CREATE POLICY "Users can delete sales for their projects"
  ON public.client_financial_sales
  FOR DELETE
  USING (
    public.is_onboarding_project_member(project_id)
    OR public.is_onboarding_assigned_staff(project_id)
    OR public.is_onboarding_admin()
  );

-- Policies for client_financial_sale_items
CREATE POLICY "Users can view sale items"
  ON public.client_financial_sale_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_financial_sales s
      WHERE s.id = sale_id
      AND (
        public.is_onboarding_project_member(s.project_id)
        OR public.is_onboarding_assigned_staff(s.project_id)
        OR public.is_onboarding_admin()
      )
    )
  );

CREATE POLICY "Users can insert sale items"
  ON public.client_financial_sale_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_financial_sales s
      WHERE s.id = sale_id
      AND (
        public.is_onboarding_project_member(s.project_id)
        OR public.is_onboarding_assigned_staff(s.project_id)
        OR public.is_onboarding_admin()
      )
    )
  );

CREATE POLICY "Users can update sale items"
  ON public.client_financial_sale_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.client_financial_sales s
      WHERE s.id = sale_id
      AND (
        public.is_onboarding_project_member(s.project_id)
        OR public.is_onboarding_assigned_staff(s.project_id)
        OR public.is_onboarding_admin()
      )
    )
  );

CREATE POLICY "Users can delete sale items"
  ON public.client_financial_sale_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.client_financial_sales s
      WHERE s.id = sale_id
      AND (
        public.is_onboarding_project_member(s.project_id)
        OR public.is_onboarding_assigned_staff(s.project_id)
        OR public.is_onboarding_admin()
      )
    )
  );

-- Create indexes for performance
CREATE INDEX idx_client_financial_products_project ON public.client_financial_products(project_id);
CREATE INDEX idx_client_financial_sales_project ON public.client_financial_sales(project_id);
CREATE INDEX idx_client_financial_sales_date ON public.client_financial_sales(sale_date);
CREATE INDEX idx_client_financial_sales_salesperson ON public.client_financial_sales(salesperson_id);
CREATE INDEX idx_client_financial_sale_items_sale ON public.client_financial_sale_items(sale_id);
CREATE INDEX idx_client_financial_sale_items_product ON public.client_financial_sale_items(product_id);

-- Triggers for updated_at
CREATE TRIGGER update_client_financial_products_updated_at
  BEFORE UPDATE ON public.client_financial_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_financial_sales_updated_at
  BEFORE UPDATE ON public.client_financial_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();