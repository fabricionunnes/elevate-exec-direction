-- Ajusta o isolamento por tenant para que policies legadas (admin/staff/member)
-- também respeitem o tenant do usuário autenticado.

-- Helper: visibilidade por tenant comum a todas as tabelas isoladas
CREATE OR REPLACE FUNCTION public.user_can_see_tenant_row(_row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      -- Master UNV (sem tenant) só vê linhas sem tenant
      WHEN public.is_master_user() THEN _row_tenant_id IS NULL
      -- Usuário com tenant só vê linhas do mesmo tenant
      WHEN public.current_user_tenant_id() IS NOT NULL THEN _row_tenant_id = public.current_user_tenant_id()
      -- Demais usuários autenticados (sem tenant atribuído) só veem linhas sem tenant
      ELSE _row_tenant_id IS NULL
    END;
$$;

-- =========================
-- onboarding_companies
-- =========================
DROP POLICY IF EXISTS "Admins can manage companies" ON public.onboarding_companies;
CREATE POLICY "Admins can manage companies"
ON public.onboarding_companies
FOR ALL
USING (public.is_onboarding_admin() AND public.user_can_see_tenant_row(tenant_id))
WITH CHECK (public.is_onboarding_admin() AND public.user_can_see_tenant_row(tenant_id));

DROP POLICY IF EXISTS "Staff can view assigned companies" ON public.onboarding_companies;
CREATE POLICY "Staff can view assigned companies"
ON public.onboarding_companies
FOR SELECT
USING (
  public.user_can_see_tenant_row(tenant_id)
  AND (
    cs_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid())
    OR consultant_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid())
    OR id IN (
      SELECT op.onboarding_company_id FROM public.onboarding_projects op
      WHERE op.onboarding_company_id IS NOT NULL
        AND (
          op.consultant_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid())
          OR op.cs_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid())
        )
    )
  )
);

DROP POLICY IF EXISTS "Project members can view their company" ON public.onboarding_companies;
CREATE POLICY "Project members can view their company"
ON public.onboarding_companies
FOR SELECT
USING (
  public.user_can_see_tenant_row(tenant_id)
  AND id IN (
    SELECT op.onboarding_company_id
    FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "CRM staff can insert companies" ON public.onboarding_companies;
CREATE POLICY "CRM staff can insert companies"
ON public.onboarding_companies
FOR INSERT
WITH CHECK (
  public.user_can_see_tenant_row(tenant_id)
  AND EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
      AND os.is_active = true
      AND os.role = ANY (ARRAY['admin','master','head_comercial','closer','sdr','cs','consultant'])
  )
);

DROP POLICY IF EXISTS "Client users can insert companies" ON public.onboarding_companies;
CREATE POLICY "Client users can insert companies"
ON public.onboarding_companies
FOR INSERT
WITH CHECK (
  public.user_can_see_tenant_row(tenant_id)
  AND EXISTS (SELECT 1 FROM public.onboarding_users ou WHERE ou.user_id = auth.uid())
);

-- =========================
-- onboarding_projects
-- =========================
DROP POLICY IF EXISTS "Staff admins can view all projects" ON public.onboarding_projects;
CREATE POLICY "Staff admins can view all projects"
ON public.onboarding_projects
FOR SELECT
USING (
  public.user_can_see_tenant_row(tenant_id)
  AND (public.is_onboarding_admin() OR public.is_onboarding_project_member(id))
);

DROP POLICY IF EXISTS "Staff admins can update projects" ON public.onboarding_projects;
CREATE POLICY "Staff admins can update projects"
ON public.onboarding_projects
FOR UPDATE
USING (public.is_onboarding_admin() AND public.user_can_see_tenant_row(tenant_id));

DROP POLICY IF EXISTS "Staff admins can delete projects" ON public.onboarding_projects;
CREATE POLICY "Staff admins can delete projects"
ON public.onboarding_projects
FOR DELETE
USING (public.is_onboarding_admin() AND public.user_can_see_tenant_row(tenant_id));

DROP POLICY IF EXISTS "Staff admins can create projects" ON public.onboarding_projects;
CREATE POLICY "Staff admins can create projects"
ON public.onboarding_projects
FOR INSERT
WITH CHECK (public.is_onboarding_admin() AND public.user_can_see_tenant_row(tenant_id));

DROP POLICY IF EXISTS "Project members can view their projects" ON public.onboarding_projects;
CREATE POLICY "Project members can view their projects"
ON public.onboarding_projects
FOR SELECT
USING (public.user_can_see_tenant_row(tenant_id) AND public.is_onboarding_project_member(id));

DROP POLICY IF EXISTS "CRM staff can insert projects" ON public.onboarding_projects;
CREATE POLICY "CRM staff can insert projects"
ON public.onboarding_projects
FOR INSERT
WITH CHECK (
  public.user_can_see_tenant_row(tenant_id)
  AND EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
      AND os.is_active = true
      AND os.role = ANY (ARRAY['head_comercial','closer','sdr','cs','consultant'])
  )
);

-- =========================
-- onboarding_users  (apenas listagem por staff/admin)
-- =========================
-- Pega policies SELECT existentes que não restringem tenant e adiciona filtro
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname='public' AND tablename='onboarding_users'
      AND policyname IN (
        'Staff can view all onboarding users',
        'Admins can manage onboarding users',
        'Staff admins can view onboarding users'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.onboarding_users', pol.policyname);
  END LOOP;
END $$;

-- Recria com filtro de tenant (se a policy original existia)
CREATE POLICY "Admins can manage onboarding users"
ON public.onboarding_users
FOR ALL
USING (public.is_onboarding_admin() AND public.user_can_see_tenant_row(tenant_id))
WITH CHECK (public.is_onboarding_admin() AND public.user_can_see_tenant_row(tenant_id));

-- =========================
-- onboarding_tasks
-- =========================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='onboarding_tasks'
      AND policyname IN (
        'Admins can manage all tasks',
        'Staff can view all tasks'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.onboarding_tasks', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can manage all tasks"
ON public.onboarding_tasks
FOR ALL
USING (
  public.is_onboarding_admin()
  AND EXISTS (
    SELECT 1 FROM public.onboarding_projects p
    WHERE p.id = onboarding_tasks.project_id
      AND public.user_can_see_tenant_row(p.tenant_id)
  )
)
WITH CHECK (
  public.is_onboarding_admin()
  AND EXISTS (
    SELECT 1 FROM public.onboarding_projects p
    WHERE p.id = onboarding_tasks.project_id
      AND public.user_can_see_tenant_row(p.tenant_id)
  )
);