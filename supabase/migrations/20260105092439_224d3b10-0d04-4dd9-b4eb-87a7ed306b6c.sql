-- Create function for updated_at if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for services/products
CREATE TABLE public.onboarding_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_services ENABLE ROW LEVEL SECURITY;

-- Only admins can manage services
CREATE POLICY "Admins can manage services"
ON public.onboarding_services
FOR ALL
USING (is_onboarding_admin());

-- Staff can view services
CREATE POLICY "Staff can view services"
ON public.onboarding_services
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM onboarding_staff 
  WHERE user_id = auth.uid() AND is_active = true
));

-- Add trigger for updated_at
CREATE TRIGGER update_onboarding_services_updated_at
BEFORE UPDATE ON public.onboarding_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert existing services from productDetails
INSERT INTO public.onboarding_services (name, slug, description) VALUES
('UNV Core', 'core', 'Programa intensivo de estruturação comercial em 6 semanas'),
('UNV Control', 'control', 'Gestão e controle de processos comerciais'),
('UNV Partners', 'partners', 'Programa de expansão através de canais'),
('UNV Growth Room', 'growth-room', 'Sala de crescimento com mentorias'),
('UNV Sales Ops', 'sales-ops', 'Operações de vendas e processos'),
('UNV Fractional CRO', 'fractional-cro', 'CRO fracionado para sua empresa'),
('UNV Execution Partnership', 'execution-partnership', 'Parceria de execução comercial'),
('UNV Sales Force', 'sales-force', 'Estruturação de equipe comercial'),
('UNV Sales Acceleration', 'sales-acceleration', 'Aceleração de vendas'),
('UNV AI Sales System', 'ai-sales-system', 'Sistema de vendas com IA'),
('UNV Finance', 'finance', 'Gestão financeira para empresas'),
('UNV People', 'people', 'Gestão de pessoas e RH'),
('UNV Leadership', 'leadership', 'Desenvolvimento de liderança'),
('UNV Mastermind', 'mastermind', 'Grupo de mentoria empresarial'),
('UNV Ads', 'ads', 'Gestão de tráfego pago'),
('UNV Social', 'social', 'Gestão de redes sociais');

-- Add RLS policies for task templates
CREATE POLICY "Admins can manage task templates"
ON public.onboarding_task_templates
FOR ALL
USING (is_onboarding_admin());

CREATE POLICY "Staff can view task templates"
ON public.onboarding_task_templates
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM onboarding_staff 
  WHERE user_id = auth.uid() AND is_active = true
));