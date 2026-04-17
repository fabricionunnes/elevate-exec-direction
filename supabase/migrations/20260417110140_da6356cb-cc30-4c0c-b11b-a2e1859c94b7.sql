
-- ============================================================================
-- WHITE-LABEL FASE 1 — FUNDAÇÃO (REVISADO 2: ordem correta)
-- ============================================================================

-- 1. PLANOS VENDÁVEIS
CREATE TABLE IF NOT EXISTS public.whitelabel_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2),
  enabled_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_users INTEGER,
  max_companies INTEGER,
  max_projects INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whitelabel_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active plans" ON public.whitelabel_plans;
CREATE POLICY "Anyone can view active plans"
  ON public.whitelabel_plans FOR SELECT
  USING (is_active = true);

-- 2. CAMPOS NOVOS EM whitelabel_tenants
ALTER TABLE public.whitelabel_tenants
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_slug TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 3. ADICIONAR tenant_id NAS TABELAS CORE (PRIMEIRO, antes das funções)

-- Staff (precisa ser primeiro pois funções dependem dele)
ALTER TABLE public.onboarding_staff
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_onboarding_staff_tenant_id ON public.onboarding_staff(tenant_id);

ALTER TABLE public.onboarding_companies
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_onboarding_companies_tenant_id ON public.onboarding_companies(tenant_id);

ALTER TABLE public.onboarding_projects
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_onboarding_projects_tenant_id ON public.onboarding_projects(tenant_id);

ALTER TABLE public.onboarding_users
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_onboarding_users_tenant_id ON public.onboarding_users(tenant_id);

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_id ON public.crm_leads(tenant_id);

ALTER TABLE public.crm_pipelines
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_crm_pipelines_tenant_id ON public.crm_pipelines(tenant_id);

ALTER TABLE public.crm_stages
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_crm_stages_tenant_id ON public.crm_stages(tenant_id);

ALTER TABLE public.financial_receivables
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_financial_receivables_tenant_id ON public.financial_receivables(tenant_id);

ALTER TABLE public.financial_payables
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_financial_payables_tenant_id ON public.financial_payables(tenant_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tasks') THEN
    EXECUTE 'ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON public.tasks(tenant_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='task_lists') THEN
    EXECUTE 'ALTER TABLE public.task_lists ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_task_lists_tenant_id ON public.task_lists(tenant_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='kpi_definitions') THEN
    EXECUTE 'ALTER TABLE public.kpi_definitions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_kpi_definitions_tenant_id ON public.kpi_definitions(tenant_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='kpi_values') THEN
    EXECUTE 'ALTER TABLE public.kpi_values ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_kpi_values_tenant_id ON public.kpi_values(tenant_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='kpi_salespeople') THEN
    EXECUTE 'ALTER TABLE public.kpi_salespeople ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_kpi_salespeople_tenant_id ON public.kpi_salespeople(tenant_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='kpi_periods') THEN
    EXECUTE 'ALTER TABLE public.kpi_periods ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_kpi_periods_tenant_id ON public.kpi_periods(tenant_id)';
  END IF;
END $$;

-- 4. FUNÇÕES DE IDENTIDADE (DEPOIS das colunas existirem)
CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_staff
    WHERE user_id = auth.uid()
      AND (role = 'master' OR email = 'fabricio@universidadevendas.com.br')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.onboarding_staff
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_master_user()
    OR (_tenant_id IS NULL AND public.get_user_tenant_id() IS NULL)
    OR _tenant_id = public.get_user_tenant_id();
$$;

-- 5. TRIGGER AUTOMÁTICO DE PREENCHIMENTO DE tenant_id
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_user_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'onboarding_companies', 'onboarding_projects', 'onboarding_users',
    'crm_leads', 'crm_pipelines', 'crm_stages',
    'financial_receivables', 'financial_payables',
    'tasks', 'task_lists',
    'kpi_definitions', 'kpi_values', 'kpi_salespeople', 'kpi_periods'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert()', t);
    END IF;
  END LOOP;
END $$;

-- 6. SEED DOS 3 PLANOS INICIAIS
INSERT INTO public.whitelabel_plans (slug, name, description, price_monthly, enabled_modules, max_users, max_companies, max_projects, is_featured, sort_order)
VALUES
  ('starter', 'Starter', 'Ideal para começar: CRM, Financeiro e Tarefas para até 3 usuários.', 297.00,
    '{"crm": true, "financial": true, "tasks": true, "onboarding": false, "kpis": false, "academy": false, "social": false, "b2b": false, "whatsapp": false, "meetings": false, "hr": false}'::jsonb,
    3, 50, 10, false, 1),
  ('pro', 'Pro', 'Para times em crescimento: tudo do Starter + KPIs e Onboarding.', 597.00,
    '{"crm": true, "financial": true, "tasks": true, "onboarding": true, "kpis": true, "academy": false, "social": false, "b2b": false, "whatsapp": false, "meetings": false, "hr": false}'::jsonb,
    10, 200, 50, true, 2),
  ('enterprise', 'Enterprise', 'Solução completa: todos os módulos liberados, sem limites.', 1497.00,
    '{"crm": true, "financial": true, "tasks": true, "onboarding": true, "kpis": true, "academy": true, "social": true, "b2b": true, "whatsapp": true, "meetings": true, "hr": true}'::jsonb,
    NULL, NULL, NULL, false, 3)
ON CONFLICT (slug) DO NOTHING;

-- 7. TRIGGER updated_at
DROP TRIGGER IF EXISTS set_whitelabel_plans_updated_at ON public.whitelabel_plans;
CREATE TRIGGER set_whitelabel_plans_updated_at
  BEFORE UPDATE ON public.whitelabel_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
