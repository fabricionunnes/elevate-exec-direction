-- Function to create default KPIs for new companies
CREATE OR REPLACE FUNCTION public.create_default_company_kpis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create default KPIs for the new company
  
  -- 1. Atendimentos (quantity type, not required)
  INSERT INTO public.company_kpis (
    company_id,
    name,
    kpi_type,
    is_required,
    is_individual,
    entry_scope,
    is_main_goal,
    sort_order,
    is_active
  ) VALUES (
    NEW.id,
    'Atendimentos',
    'quantity',
    false,
    true,
    'company',
    false,
    1,
    true
  );

  -- 2. Vendas (quantity type, required)
  INSERT INTO public.company_kpis (
    company_id,
    name,
    kpi_type,
    is_required,
    is_individual,
    entry_scope,
    is_main_goal,
    sort_order,
    is_active
  ) VALUES (
    NEW.id,
    'Vendas',
    'quantity',
    true,
    true,
    'company',
    false,
    2,
    true
  );

  -- 3. Faturamento (monetary type, required)
  INSERT INTO public.company_kpis (
    company_id,
    name,
    kpi_type,
    is_required,
    is_individual,
    entry_scope,
    is_main_goal,
    sort_order,
    is_active
  ) VALUES (
    NEW.id,
    'Faturamento',
    'monetary',
    true,
    true,
    'company',
    false,
    3,
    true
  );

  RETURN NEW;
END;
$$;

-- Create trigger to auto-create KPIs when a new company is created
DROP TRIGGER IF EXISTS create_default_kpis_on_company_insert ON public.onboarding_companies;
CREATE TRIGGER create_default_kpis_on_company_insert
  AFTER INSERT ON public.onboarding_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_company_kpis();