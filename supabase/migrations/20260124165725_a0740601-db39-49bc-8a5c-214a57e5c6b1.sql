-- Add sort_order column to persist clause ordering
ALTER TABLE public.contract_template_clauses 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;