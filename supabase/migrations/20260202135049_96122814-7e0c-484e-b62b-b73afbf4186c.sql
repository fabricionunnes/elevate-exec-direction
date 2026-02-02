
-- Create table for CRM payment method options
CREATE TABLE IF NOT EXISTS public.crm_payment_method_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for CRM bank options
CREATE TABLE IF NOT EXISTS public.crm_bank_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_payment_method_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_bank_options ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (staff access)
CREATE POLICY "Staff can view payment method options" 
ON public.crm_payment_method_options 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Staff can manage payment method options" 
ON public.crm_payment_method_options 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Staff can view bank options" 
ON public.crm_bank_options 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Staff can manage bank options" 
ON public.crm_bank_options 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert some default payment methods
INSERT INTO public.crm_payment_method_options (name, sort_order) VALUES
('PIX', 1),
('Cartão de Crédito', 2),
('Cartão de Débito', 3),
('Boleto', 4),
('Transferência Bancária', 5),
('Dinheiro', 6);

-- Insert some default banks
INSERT INTO public.crm_bank_options (name, sort_order) VALUES
('Banco do Brasil', 1),
('Bradesco', 2),
('Caixa Econômica', 3),
('Itaú', 4),
('Santander', 5),
('Nubank', 6),
('Inter', 7),
('C6 Bank', 8);
