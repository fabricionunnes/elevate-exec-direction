-- Tabela para definir campos personalizáveis por contexto (contato, empresa, negócio)
CREATE TABLE IF NOT EXISTS public.crm_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context VARCHAR(50) NOT NULL, -- 'contact', 'company', 'deal'
  section VARCHAR(100) NOT NULL DEFAULT 'Informações Gerais',
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(200) NOT NULL,
  field_type VARCHAR(50) NOT NULL DEFAULT 'text', -- text, number, select, date, phone, email, url, textarea
  options JSONB, -- para campos do tipo select
  is_required BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false, -- campos do sistema não podem ser excluídos
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Valores dos campos personalizados por lead
CREATE TABLE IF NOT EXISTS public.crm_custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.crm_custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, field_id)
);

-- Arquivos do lead
CREATE TABLE IF NOT EXISTS public.crm_lead_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_files ENABLE ROW LEVEL SECURITY;

-- Policies para staff acessar
CREATE POLICY "Staff can read custom fields" ON public.crm_custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage custom fields" ON public.crm_custom_fields FOR ALL TO authenticated USING (true);

CREATE POLICY "Staff can read field values" ON public.crm_custom_field_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage field values" ON public.crm_custom_field_values FOR ALL TO authenticated USING (true);

CREATE POLICY "Staff can read lead files" ON public.crm_lead_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage lead files" ON public.crm_lead_files FOR ALL TO authenticated USING (true);

-- Inserir campos padrão de contato
INSERT INTO public.crm_custom_fields (context, section, field_name, field_label, field_type, is_system, sort_order) VALUES
('contact', 'Informações Gerais', 'name', 'Nome', 'text', true, 1),
('contact', 'Informações Gerais', 'company', 'Minha Empresa', 'text', true, 2),
('contact', 'Informações Gerais', 'email', 'Email', 'email', true, 3),
('contact', 'Informações Gerais', 'phone', 'Telefone', 'phone', true, 4),
('contact', 'Informações Gerais', 'phone2', 'Telefone 2', 'phone', false, 5),
('contact', 'Informações Gerais', 'instagram', 'Instagram', 'text', false, 6),
('contact', 'Informações Gerais', 'referral_name', 'Nome de quem indicou', 'text', false, 7),
('contact', 'Informações Gerais', 'referral_company', 'Empresa de quem indicou', 'text', false, 8),
('contact', 'Informações Gerais', 'cpf', 'CPF', 'text', false, 9),
('contact', 'Informações Gerais', 'utm_source', 'utm_source', 'text', false, 10),
('contact', 'Informações Gerais', 'utm_campaign', 'utm_campaign', 'text', false, 11);

-- Campos padrão de empresa
INSERT INTO public.crm_custom_fields (context, section, field_name, field_label, field_type, is_system, sort_order) VALUES
('company', 'Informações Gerais', 'company_name', 'Nome da empresa', 'text', true, 1),
('company', 'Informações Gerais', 'cnpj', 'CNPJ', 'text', false, 2),
('company', 'Informações Gerais', 'company_phone', 'Telefone', 'phone', false, 3),
('company', 'Informações Gerais', 'company_email', 'Email', 'email', false, 4),
('company', 'Informações Gerais', 'website', 'URL', 'url', false, 5),
('company', 'Informações Gerais', 'city', 'Cidade', 'text', false, 6),
('company', 'Informações Gerais', 'state', 'Estado', 'text', false, 7),
('company', 'Informações Gerais', 'cep', 'CEP', 'text', false, 8),
('company', 'Informações Gerais', 'category', 'Categoria', 'text', false, 9),
('company', 'Informações Gerais', 'segment', 'Segmento', 'text', false, 10),
('company', 'Informações Gerais', 'employee_count', 'Número de funcionários', 'select', false, 11),
('company', 'Informações Gerais', 'business_model', 'Modelo de negócios', 'text', false, 12);

-- Campos padrão de negócio
INSERT INTO public.crm_custom_fields (context, section, field_name, field_label, field_type, is_system, sort_order) VALUES
('deal', 'Informações Gerais', 'opportunity_value', 'Valor', 'number', true, 1),
('deal', 'Informações Gerais', 'closer', 'Closer', 'select', false, 2),
('deal', 'Informações Gerais', 'sdr', 'SDR', 'select', false, 3),
('deal', 'Informações Gerais', 'meeting_link', 'Link da Reunião', 'url', false, 4),
('deal', 'Informações Gerais', 'product', 'Produto', 'select', false, 5),
('deal', 'Informações Gerais', 'payment_method', 'Forma de pagamento', 'select', false, 6),
('deal', 'Informações Gerais', 'bank', 'Banco', 'select', false, 7),
('deal', 'Informações Gerais', 'plan', 'Plano', 'select', false, 8),
('deal', 'Informações Gerais', 'due_date', 'Vencimento da parcela', 'select', false, 9),
('deal', 'Informações Gerais', 'briefing', 'Briefing', 'textarea', false, 10),
('deal', 'Informações Gerais', 'origin_name', 'Funil', 'text', true, 11),
('deal', 'Informações Gerais', 'notes', 'Notas', 'textarea', false, 12);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_crm_custom_fields_updated_at
BEFORE UPDATE ON public.crm_custom_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_crm_custom_field_values_updated_at
BEFORE UPDATE ON public.crm_custom_field_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();