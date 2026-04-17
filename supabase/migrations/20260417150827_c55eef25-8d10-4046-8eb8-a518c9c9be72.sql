-- 1) Coluna tenant_id em whitelabel_plans
ALTER TABLE public.whitelabel_plans
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_whitelabel_plans_tenant ON public.whitelabel_plans(tenant_id);

-- Drop a constraint UNIQUE de slug (que cria o índice automaticamente)
ALTER TABLE public.whitelabel_plans DROP CONSTRAINT IF EXISTS whitelabel_plans_slug_key CASCADE;

-- Slugs únicos parciais
CREATE UNIQUE INDEX IF NOT EXISTS uniq_plan_slug_global
  ON public.whitelabel_plans(slug) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_plan_slug_per_tenant
  ON public.whitelabel_plans(tenant_id, slug) WHERE tenant_id IS NOT NULL;

-- 2) Helper: usuário é master da plataforma?
CREATE OR REPLACE FUNCTION public.is_platform_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.role = 'master'
      AND s.tenant_id IS NULL
  );
$$;

-- 3) Políticas de whitelabel_plans
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.whitelabel_plans;
DROP POLICY IF EXISTS "View active plans (global or own tenant)" ON public.whitelabel_plans;
DROP POLICY IF EXISTS "Platform masters manage plans (insert)" ON public.whitelabel_plans;
DROP POLICY IF EXISTS "Platform masters manage plans (update)" ON public.whitelabel_plans;
DROP POLICY IF EXISTS "Platform masters manage plans (delete)" ON public.whitelabel_plans;

CREATE POLICY "View active plans (global or own tenant)"
ON public.whitelabel_plans
FOR SELECT
TO authenticated, anon
USING (
  is_active = true
  AND (
    tenant_id IS NULL
    OR is_platform_master()
    OR is_ceo()
    OR is_tenant_member(tenant_id)
  )
);

CREATE POLICY "Platform masters manage plans (insert)"
ON public.whitelabel_plans
FOR INSERT
TO authenticated
WITH CHECK (is_platform_master() OR is_ceo());

CREATE POLICY "Platform masters manage plans (update)"
ON public.whitelabel_plans
FOR UPDATE
TO authenticated
USING (is_platform_master() OR is_ceo())
WITH CHECK (is_platform_master() OR is_ceo());

CREATE POLICY "Platform masters manage plans (delete)"
ON public.whitelabel_plans
FOR DELETE
TO authenticated
USING (is_platform_master() OR is_ceo());

-- 4) Histórico de mudanças de plano
CREATE TABLE IF NOT EXISTS public.whitelabel_tenant_plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  previous_plan_slug TEXT,
  new_plan_slug TEXT NOT NULL,
  previous_max_projects INTEGER,
  new_max_projects INTEGER,
  previous_max_users INTEGER,
  new_max_users INTEGER,
  changed_by UUID,
  changed_by_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_history_tenant ON public.whitelabel_tenant_plan_history(tenant_id, created_at DESC);

ALTER TABLE public.whitelabel_tenant_plan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View plan history (master, CEO, tenant admin)" ON public.whitelabel_tenant_plan_history;
DROP POLICY IF EXISTS "Insert plan history (master, CEO)" ON public.whitelabel_tenant_plan_history;

CREATE POLICY "View plan history (master, CEO, tenant admin)"
ON public.whitelabel_tenant_plan_history
FOR SELECT
TO authenticated
USING (is_platform_master() OR is_ceo() OR is_tenant_admin(tenant_id));

CREATE POLICY "Insert plan history (master, CEO)"
ON public.whitelabel_tenant_plan_history
FOR INSERT
TO authenticated
WITH CHECK (is_platform_master() OR is_ceo());

-- 5) Trigger updated_at
DROP TRIGGER IF EXISTS trg_whitelabel_plans_updated ON public.whitelabel_plans;
CREATE TRIGGER trg_whitelabel_plans_updated
BEFORE UPDATE ON public.whitelabel_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();