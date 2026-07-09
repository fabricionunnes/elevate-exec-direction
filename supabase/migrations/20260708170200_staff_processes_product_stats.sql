-- Estatísticas vivas de contratos por produto pro Manual de Processos.
-- SECURITY DEFINER com checagem de staff UNV ativo — não expõe dados de cliente individual, só agregados.
CREATE OR REPLACE FUNCTION public.get_product_contract_stats()
RETURNS TABLE (
  product_name text,
  ativos bigint,
  mediana numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true AND tenant_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Acesso restrito ao staff UNV';
  END IF;

  RETURN QUERY
  SELECT
    p.product_name,
    count(*) AS ativos,
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY COALESCE(NULLIF(p.contract_value, 0), NULLIF(c.contract_value, 0))
    )::numeric AS mediana
  FROM onboarding_projects p
  LEFT JOIN onboarding_companies c ON c.id = p.onboarding_company_id
  WHERE p.status = 'active' AND p.product_name IS NOT NULL
  GROUP BY p.product_name
  ORDER BY count(*) DESC;
END;
$$;

-- Higiene de cadastro: nome de produto duplicado por caixa divergente
UPDATE onboarding_projects SET product_name = 'UNV Partners' WHERE product_name = 'UNV PARTNERS';
