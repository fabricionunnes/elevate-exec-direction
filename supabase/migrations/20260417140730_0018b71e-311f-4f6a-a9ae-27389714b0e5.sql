-- =====================================================================
-- WHITE-LABEL TENANT ISOLATION
-- Auto-fill tenant_id on insert + RLS visibility policies
-- =====================================================================

-- 1. Helper: returns the tenant_id of the logged-in staff user (NULL = master)
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
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

-- 2. Helper: is the current user a master (no tenant_id)?
CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_staff
    WHERE user_id = auth.uid()
      AND is_active = true
      AND tenant_id IS NULL
      AND role = 'master'
  );
$$;

-- 3. Generic BEFORE INSERT trigger: stamp tenant_id from current staff user
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  -- Respect explicitly provided tenant_id (admin tools, migrations, edge functions)
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_tenant := public.current_user_tenant_id();
  -- If staff lookup found a tenant, stamp it; master users keep NULL
  IF v_tenant IS NOT NULL THEN
    NEW.tenant_id := v_tenant;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Apply trigger to every isolated table
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'onboarding_companies',
    'onboarding_projects',
    'onboarding_users',
    'crm_leads',
    'crm_pipelines',
    'crm_stages',
    'financial_payables',
    'financial_receivables',
    'kpi_salespeople'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert()',
      t
    );
  END LOOP;
END;
$$;

-- 5. Tenant-scoped visibility policies
-- Master sees only NULL-tenant rows (the legacy 727 companies + 142 projects + their own creations)
-- White-label admins see only rows of their tenant
-- We add this as an *additional* permissive policy named with prefix tenant_iso_
-- so existing policies keep working and we layer tenant filtering on top via RESTRICTIVE.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'onboarding_companies',
    'onboarding_projects',
    'onboarding_users',
    'crm_leads',
    'crm_pipelines',
    'crm_stages',
    'financial_payables',
    'financial_receivables',
    'kpi_salespeople'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    -- Drop previous restrictive policies if re-running
    EXECUTE format('DROP POLICY IF EXISTS tenant_iso_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_iso_modify ON public.%I', t);

    -- RESTRICTIVE: row must satisfy tenant match (in addition to whatever permissive policies exist)
    EXECUTE format($f$
      CREATE POLICY tenant_iso_select ON public.%I
      AS RESTRICTIVE
      FOR SELECT
      TO authenticated
      USING (
        -- Service role / no auth context bypass via SECURITY DEFINER funcs is intentional
        CASE
          WHEN public.is_master_user() THEN tenant_id IS NULL
          WHEN public.current_user_tenant_id() IS NOT NULL THEN tenant_id = public.current_user_tenant_id()
          ELSE true  -- non-staff users (clients) keep existing access through other policies
        END
      )
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY tenant_iso_modify ON public.%I
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING (
        CASE
          WHEN public.is_master_user() THEN tenant_id IS NULL
          WHEN public.current_user_tenant_id() IS NOT NULL THEN tenant_id = public.current_user_tenant_id()
          ELSE true
        END
      )
      WITH CHECK (
        CASE
          WHEN public.is_master_user() THEN tenant_id IS NULL
          WHEN public.current_user_tenant_id() IS NOT NULL THEN tenant_id = public.current_user_tenant_id() OR tenant_id IS NULL
          ELSE true
        END
      )
    $f$, t);
  END LOOP;
END;
$$;
