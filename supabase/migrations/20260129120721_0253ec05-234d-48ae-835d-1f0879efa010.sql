-- Fix: ensure default KPIs include required NOT NULL field periodicity

CREATE OR REPLACE FUNCTION public.create_default_company_kpis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Atendimentos (quantity, not required)
  INSERT INTO public.company_kpis (
    company_id,
    name,
    kpi_type,
    periodicity,
    is_required,
    is_individual,
    scope,
    is_main_goal,
    sort_order,
    is_active,
    target_value
  ) VALUES (
    NEW.id,
    'Atendimentos',
    'quantity',
    'monthly',
    false,
    true,
    'company',
    false,
    1,
    true,
    0
  );

  -- 2. Vendas (quantity, required)
  INSERT INTO public.company_kpis (
    company_id,
    name,
    kpi_type,
    periodicity,
    is_required,
    is_individual,
    scope,
    is_main_goal,
    sort_order,
    is_active,
    target_value
  ) VALUES (
    NEW.id,
    'Vendas',
    'quantity',
    'monthly',
    true,
    true,
    'company',
    false,
    2,
    true,
    0
  );

  -- 3. Faturamento (monetary, required)
  INSERT INTO public.company_kpis (
    company_id,
    name,
    kpi_type,
    periodicity,
    is_required,
    is_individual,
    scope,
    is_main_goal,
    sort_order,
    is_active,
    target_value
  ) VALUES (
    NEW.id,
    'Faturamento',
    'monetary',
    'monthly',
    true,
    true,
    'company',
    false,
    3,
    true,
    0
  );

  RETURN NEW;
END;
$$;