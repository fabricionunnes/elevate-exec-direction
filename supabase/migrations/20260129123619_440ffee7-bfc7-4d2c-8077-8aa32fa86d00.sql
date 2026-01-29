-- Fix the create_default_company_kpis function to use valid kpi_type values
-- The constraint allows: 'numeric', 'monetary', 'percentage'
-- Currently using 'quantity' which is invalid

CREATE OR REPLACE FUNCTION public.create_default_company_kpis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Atendimentos (numeric, not required)
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
    'numeric',
    'monthly',
    false,
    true,
    'company',
    false,
    1,
    true,
    0
  );

  -- 2. Vendas (numeric, required)
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
    'numeric',
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
$function$;