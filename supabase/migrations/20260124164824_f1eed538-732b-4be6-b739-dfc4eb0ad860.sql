-- Create table to store custom contract template clauses
CREATE TABLE public.contract_template_clauses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_dynamic BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by TEXT
);

-- Enable RLS
ALTER TABLE public.contract_template_clauses ENABLE ROW LEVEL SECURITY;

-- Create policy: All authenticated users can read
CREATE POLICY "Authenticated users can read contract template clauses"
ON public.contract_template_clauses
FOR SELECT
TO authenticated
USING (true);

-- Create policy: Only CEO can insert/update/delete
CREATE POLICY "Only CEO can modify contract template clauses"
ON public.contract_template_clauses
FOR ALL
TO authenticated
USING (public.is_ceo())
WITH CHECK (public.is_ceo());

-- Add comment
COMMENT ON TABLE public.contract_template_clauses IS 'Stores customized contract template clauses that override defaults';