
-- 1. Create whitelabel_tenants table
CREATE TABLE public.whitelabel_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  logo_url TEXT,
  favicon_url TEXT,
  platform_name TEXT NOT NULL DEFAULT 'UNV Nexus',
  theme_colors JSONB DEFAULT '{"primary":"355 85% 50%","accent":"355 90% 55%","background":"0 0% 100%","foreground":"214 65% 15%","card":"0 0% 100%","muted":"214 15% 94%"}'::jsonb,
  is_dark_mode BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('active','suspended','trial','cancelled')),
  max_active_projects INTEGER NOT NULL DEFAULT 5,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create whitelabel_subscriptions table
CREATE TABLE public.whitelabel_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  price_per_project NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  active_projects_count INTEGER NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled','trialing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create whitelabel_tenant_users table
CREATE TABLE public.whitelabel_tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- 4. Security definer function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.whitelabel_tenant_users
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- 5. Security definer function to check tenant membership
CREATE OR REPLACE FUNCTION public.is_tenant_member(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whitelabel_tenant_users
    WHERE user_id = auth.uid() AND tenant_id = check_tenant_id
  )
$$;

-- 6. Security definer function to check tenant owner/admin
CREATE OR REPLACE FUNCTION public.is_tenant_admin(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whitelabel_tenant_users
    WHERE user_id = auth.uid() AND tenant_id = check_tenant_id AND role IN ('owner','admin')
  )
$$;

-- 7. Enable RLS on all 3 tables
ALTER TABLE public.whitelabel_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_tenant_users ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies for whitelabel_tenants
CREATE POLICY "Tenant members can view their tenant"
ON public.whitelabel_tenants FOR SELECT TO authenticated
USING (public.is_tenant_member(id));

CREATE POLICY "Tenant admins can update their tenant"
ON public.whitelabel_tenants FOR UPDATE TO authenticated
USING (public.is_tenant_admin(id))
WITH CHECK (public.is_tenant_admin(id));

CREATE POLICY "Anyone can view tenant by domain for resolution"
ON public.whitelabel_tenants FOR SELECT TO anon, authenticated
USING (status = 'active' OR status = 'trial');

-- 9. RLS policies for whitelabel_subscriptions
CREATE POLICY "Tenant members can view subscriptions"
ON public.whitelabel_subscriptions FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can manage subscriptions"
ON public.whitelabel_subscriptions FOR ALL TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

-- 10. RLS policies for whitelabel_tenant_users
CREATE POLICY "Tenant members can view other members"
ON public.whitelabel_tenant_users FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can manage members"
ON public.whitelabel_tenant_users FOR ALL TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Users can view their own membership"
ON public.whitelabel_tenant_users FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 11. Add tenant_id to onboarding_companies
ALTER TABLE public.onboarding_companies
ADD COLUMN tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE SET NULL;

-- 12. Add tenant_id to onboarding_projects
ALTER TABLE public.onboarding_projects
ADD COLUMN tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE SET NULL;

-- 13. Create index for fast domain resolution
CREATE INDEX idx_whitelabel_tenants_domain ON public.whitelabel_tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_whitelabel_tenants_slug ON public.whitelabel_tenants(slug);
CREATE INDEX idx_whitelabel_tenant_users_user ON public.whitelabel_tenant_users(user_id);
CREATE INDEX idx_onboarding_companies_tenant ON public.onboarding_companies(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_onboarding_projects_tenant ON public.onboarding_projects(tenant_id) WHERE tenant_id IS NOT NULL;
