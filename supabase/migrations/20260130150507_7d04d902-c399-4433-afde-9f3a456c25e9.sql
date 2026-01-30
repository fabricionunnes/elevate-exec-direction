-- Create CRM Plans table for product plans
CREATE TABLE public.crm_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  product_id UUID REFERENCES public.crm_products(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_plans ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Authenticated users can view plans"
  ON public.crm_plans
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage plans"
  ON public.crm_plans
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_crm_plans_updated_at
  BEFORE UPDATE ON public.crm_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add some sample plans
INSERT INTO public.crm_plans (name, sort_order) VALUES
  ('Mensal', 1),
  ('Trimestral', 2),
  ('Semestral', 3),
  ('Anual', 4);

-- Update product and plan fields to be system fields for proper handling
UPDATE public.crm_custom_fields 
SET is_system = true, field_name = 'product_id'
WHERE field_name = 'product' AND context = 'deal';

UPDATE public.crm_custom_fields 
SET is_system = true, field_name = 'plan_id'
WHERE field_name = 'plan' AND context = 'deal';

-- Add product_id and plan_id columns to crm_leads if not exist
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.crm_products(id) ON DELETE SET NULL;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.crm_plans(id) ON DELETE SET NULL;