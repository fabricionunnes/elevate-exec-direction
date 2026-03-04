
ALTER TABLE public.company_invoices DROP CONSTRAINT IF EXISTS company_invoices_category_id_fkey;

ALTER TABLE public.company_invoices DROP CONSTRAINT IF EXISTS company_invoices_cost_center_id_fkey;
