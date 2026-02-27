
-- Financial Categories (Plano de Contas)
CREATE TABLE public.staff_financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  group_name TEXT NOT NULL DEFAULT 'Operacional',
  parent_id UUID REFERENCES public.staff_financial_categories(id) ON DELETE SET NULL,
  dre_line TEXT,
  dfc_section TEXT CHECK (dfc_section IN ('operacional', 'investimento', 'financiamento')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view categories" ON public.staff_financial_categories
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin/master can manage categories" ON public.staff_financial_categories
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master'))
  );

-- Financial Entries (Lançamentos manuais)
CREATE TABLE public.staff_financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  category_id UUID REFERENCES public.staff_financial_categories(id),
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  paid_amount_cents BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  bank_id UUID REFERENCES public.financial_banks(id),
  payment_method TEXT,
  reference_month DATE,
  notes TEXT,
  company_id UUID REFERENCES public.onboarding_companies(id),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'invoice', 'payable')),
  source_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view entries" ON public.staff_financial_entries
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin/master can manage entries" ON public.staff_financial_entries
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master'))
  );

-- Add category_id to existing financial_payables
ALTER TABLE public.financial_payables ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.staff_financial_categories(id);

-- Seed default categories (Plano de Contas básico)
INSERT INTO public.staff_financial_categories (name, type, group_name, dre_line, dfc_section, sort_order) VALUES
-- Receitas
('Receita de Consultoria', 'receita', 'Receita Bruta', 'receita_bruta', 'operacional', 1),
('Receita de Treinamentos', 'receita', 'Receita Bruta', 'receita_bruta', 'operacional', 2),
('Receita de Assinaturas', 'receita', 'Receita Bruta', 'receita_bruta', 'operacional', 3),
('Outras Receitas', 'receita', 'Receita Bruta', 'receita_bruta', 'operacional', 4),
('(-) Impostos sobre Receita', 'receita', 'Deduções', 'deducoes', 'operacional', 5),
('(-) Devoluções e Abatimentos', 'receita', 'Deduções', 'deducoes', 'operacional', 6),
-- Despesas operacionais
('Salários e Encargos', 'despesa', 'Despesas com Pessoal', 'despesas_pessoal', 'operacional', 10),
('Benefícios', 'despesa', 'Despesas com Pessoal', 'despesas_pessoal', 'operacional', 11),
('Comissões', 'despesa', 'Despesas com Pessoal', 'despesas_pessoal', 'operacional', 12),
('Aluguel', 'despesa', 'Despesas Administrativas', 'despesas_admin', 'operacional', 20),
('Energia / Internet / Telefone', 'despesa', 'Despesas Administrativas', 'despesas_admin', 'operacional', 21),
('Software e Ferramentas', 'despesa', 'Despesas Administrativas', 'despesas_admin', 'operacional', 22),
('Contabilidade / Jurídico', 'despesa', 'Despesas Administrativas', 'despesas_admin', 'operacional', 23),
('Material de Escritório', 'despesa', 'Despesas Administrativas', 'despesas_admin', 'operacional', 24),
('Marketing e Publicidade', 'despesa', 'Despesas Comerciais', 'despesas_comerciais', 'operacional', 30),
('Tráfego Pago', 'despesa', 'Despesas Comerciais', 'despesas_comerciais', 'operacional', 31),
('Eventos e Viagens', 'despesa', 'Despesas Comerciais', 'despesas_comerciais', 'operacional', 32),
-- Investimentos
('Equipamentos', 'despesa', 'Investimentos', 'investimentos', 'investimento', 40),
('Reformas e Melhorias', 'despesa', 'Investimentos', 'investimentos', 'investimento', 41),
-- Financeiro
('Juros e Multas', 'despesa', 'Despesas Financeiras', 'despesas_financeiras', 'financiamento', 50),
('Tarifas Bancárias', 'despesa', 'Despesas Financeiras', 'despesas_financeiras', 'financiamento', 51),
('Empréstimos', 'despesa', 'Despesas Financeiras', 'despesas_financeiras', 'financiamento', 52);
