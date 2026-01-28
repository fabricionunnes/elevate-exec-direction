-- Create junction table for salespeople-units many-to-many relationship
CREATE TABLE public.company_salesperson_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id UUID NOT NULL REFERENCES public.company_salespeople(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.company_units(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(salesperson_id, unit_id)
);

-- Enable RLS
ALTER TABLE public.company_salesperson_units ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view salesperson units" ON public.company_salesperson_units
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage salesperson units" ON public.company_salesperson_units
  FOR ALL USING (auth.role() = 'authenticated');

-- Create index for performance
CREATE INDEX idx_salesperson_units_salesperson ON public.company_salesperson_units(salesperson_id);
CREATE INDEX idx_salesperson_units_unit ON public.company_salesperson_units(unit_id);

-- Migrate existing unit_id data to junction table
INSERT INTO public.company_salesperson_units (salesperson_id, unit_id)
SELECT id, unit_id FROM public.company_salespeople WHERE unit_id IS NOT NULL
ON CONFLICT DO NOTHING;