ALTER TABLE public.company_recurring_charges 
ADD COLUMN IF NOT EXISTS pagarme_plan_id text,
ADD COLUMN IF NOT EXISTS pagarme_link_id text,
ADD COLUMN IF NOT EXISTS pagarme_link_url text;