-- Fix the function to use correct column name (scope instead of entry_scope)
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
    scope,
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
    scope,
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
    scope,
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