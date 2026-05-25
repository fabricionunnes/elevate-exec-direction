-- Migrate existing contract data from onboarding_companies to onboarding_projects
-- Copies company-level contract fields to all projects of that company
-- Only fills in fields that are still NULL on the project (won't overwrite if already set)

UPDATE public.onboarding_projects p
SET
  contract_start_date = COALESCE(p.contract_start_date, c.contract_start_date),
  contract_end_date   = COALESCE(p.contract_end_date,   c.contract_end_date),
  contract_value      = COALESCE(p.contract_value,      c.contract_value),
  billing_day         = COALESCE(p.billing_day,         c.billing_day)
FROM public.onboarding_companies c
WHERE p.onboarding_company_id = c.id
  AND (
    c.contract_start_date IS NOT NULL OR
    c.contract_end_date   IS NOT NULL OR
    c.contract_value      IS NOT NULL OR
    c.billing_day         IS NOT NULL
  );
