-- =============================================
-- PORTAL PLANEJAMENTO 2026 - DATABASE SCHEMA
-- =============================================

-- Enum for user roles in the portal
CREATE TYPE public.portal_role AS ENUM ('admin_unv', 'admin_company', 'member');

-- Enum for plan status
CREATE TYPE public.plan_status AS ENUM ('draft', 'published', 'archived');

-- Enum for KR/initiative status
CREATE TYPE public.progress_status AS ENUM ('on_track', 'attention', 'off_track', 'completed');

-- =============================================
-- COMPANIES (Multi-tenant root)
-- =============================================
CREATE TABLE public.portal_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT,
  size TEXT,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_companies ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PORTAL USERS (linked to auth.users)
-- =============================================
CREATE TABLE public.portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.portal_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role portal_role NOT NULL DEFAULT 'member',
  lgpd_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- COMPANY INVITES
-- =============================================
CREATE TABLE public.portal_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.portal_companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role portal_role NOT NULL DEFAULT 'member',
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_invites ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PLANS (Strategic plans per company/year)
-- =============================================
CREATE TABLE public.portal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.portal_companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL DEFAULT 2026,
  version INTEGER NOT NULL DEFAULT 1,
  status plan_status NOT NULL DEFAULT 'draft',
  theme TEXT,
  vision TEXT,
  current_step INTEGER NOT NULL DEFAULT 1,
  context_data JSONB DEFAULT '{}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_plans ENABLE ROW LEVEL SECURITY;

-- =============================================
-- NORTH STAR METRIC
-- =============================================
CREATE TABLE public.portal_north_stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.portal_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  definition TEXT,
  unit TEXT,
  annual_target NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_north_stars ENABLE ROW LEVEL SECURITY;

-- =============================================
-- OBJECTIVES (OKRs - O)
-- =============================================
CREATE TABLE public.portal_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.portal_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_user_id UUID REFERENCES public.portal_users(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_objectives ENABLE ROW LEVEL SECURITY;

-- =============================================
-- KEY RESULTS (OKRs - KR)
-- =============================================
CREATE TABLE public.portal_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES public.portal_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  unit TEXT,
  target NUMERIC NOT NULL DEFAULT 0,
  baseline NUMERIC DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  status progress_status NOT NULL DEFAULT 'on_track',
  quarter INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_key_results ENABLE ROW LEVEL SECURITY;

-- =============================================
-- INITIATIVES (Actions for KRs)
-- =============================================
CREATE TABLE public.portal_initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id UUID NOT NULL REFERENCES public.portal_key_results(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_user_id UUID REFERENCES public.portal_users(id) ON DELETE SET NULL,
  effort TEXT,
  deadline DATE,
  status progress_status NOT NULL DEFAULT 'on_track',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_initiatives ENABLE ROW LEVEL SECURITY;

-- =============================================
-- QUARTERLY ROCKS
-- =============================================
CREATE TABLE public.portal_rocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.portal_plans(id) ON DELETE CASCADE,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  title TEXT NOT NULL,
  description TEXT,
  target TEXT,
  owner_user_id UUID REFERENCES public.portal_users(id) ON DELETE SET NULL,
  status progress_status NOT NULL DEFAULT 'on_track',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_rocks ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PRODUCT CATALOG (UNV Solutions)
-- =============================================
CREATE TABLE public.portal_product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_description TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  cta_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_product_catalog ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AI CHAT LOGS
-- =============================================
CREATE TABLE public.portal_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.portal_companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'planning',
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_chat_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AUDIT LOGS
-- =============================================
CREATE TABLE public.portal_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.portal_companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.portal_users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Check if user is UNV admin
CREATE OR REPLACE FUNCTION public.is_portal_admin_unv(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE user_id = check_user_id AND role = 'admin_unv'
  )
$$;

-- Get user's company_id
CREATE OR REPLACE FUNCTION public.get_portal_company_id(check_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.portal_users WHERE user_id = check_user_id LIMIT 1
$$;

-- Check if user belongs to company
CREATE OR REPLACE FUNCTION public.is_portal_company_member(check_user_id UUID, check_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE user_id = check_user_id AND company_id = check_company_id
  )
$$;

-- Check if user is company admin or UNV admin
CREATE OR REPLACE FUNCTION public.is_portal_company_admin(check_user_id UUID, check_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_users
    WHERE user_id = check_user_id 
    AND (role = 'admin_unv' OR (role = 'admin_company' AND company_id = check_company_id))
  )
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- PORTAL_COMPANIES
CREATE POLICY "UNV admins can manage all companies"
  ON public.portal_companies FOR ALL
  USING (public.is_portal_admin_unv(auth.uid()));

CREATE POLICY "Users can view their own company"
  ON public.portal_companies FOR SELECT
  USING (id = public.get_portal_company_id(auth.uid()));

CREATE POLICY "Anyone can view company by invite code"
  ON public.portal_companies FOR SELECT
  USING (true);

-- PORTAL_USERS
CREATE POLICY "UNV admins can manage all users"
  ON public.portal_users FOR ALL
  USING (public.is_portal_admin_unv(auth.uid()));

CREATE POLICY "Users can view members of their company"
  ON public.portal_users FOR SELECT
  USING (company_id = public.get_portal_company_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.portal_users FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert portal user on signup"
  ON public.portal_users FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- PORTAL_INVITES
CREATE POLICY "Company admins can manage invites"
  ON public.portal_invites FOR ALL
  USING (public.is_portal_company_admin(auth.uid(), company_id));

CREATE POLICY "Anyone can view invite by token"
  ON public.portal_invites FOR SELECT
  USING (true);

-- PORTAL_PLANS
CREATE POLICY "Company members can view their plans"
  ON public.portal_plans FOR SELECT
  USING (public.is_portal_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can create plans"
  ON public.portal_plans FOR INSERT
  WITH CHECK (public.is_portal_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can update their plans"
  ON public.portal_plans FOR UPDATE
  USING (public.is_portal_company_member(auth.uid(), company_id));

CREATE POLICY "UNV admins can manage all plans"
  ON public.portal_plans FOR ALL
  USING (public.is_portal_admin_unv(auth.uid()));

-- PORTAL_NORTH_STARS
CREATE POLICY "Members can manage north stars of their plans"
  ON public.portal_north_stars FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portal_plans p
      WHERE p.id = plan_id AND public.is_portal_company_member(auth.uid(), p.company_id)
    )
  );

-- PORTAL_OBJECTIVES
CREATE POLICY "Members can manage objectives of their plans"
  ON public.portal_objectives FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portal_plans p
      WHERE p.id = plan_id AND public.is_portal_company_member(auth.uid(), p.company_id)
    )
  );

-- PORTAL_KEY_RESULTS
CREATE POLICY "Members can manage key results of their objectives"
  ON public.portal_key_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portal_objectives o
      JOIN public.portal_plans p ON p.id = o.plan_id
      WHERE o.id = objective_id AND public.is_portal_company_member(auth.uid(), p.company_id)
    )
  );

-- PORTAL_INITIATIVES
CREATE POLICY "Members can manage initiatives of their key results"
  ON public.portal_initiatives FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portal_key_results kr
      JOIN public.portal_objectives o ON o.id = kr.objective_id
      JOIN public.portal_plans p ON p.id = o.plan_id
      WHERE kr.id = key_result_id AND public.is_portal_company_member(auth.uid(), p.company_id)
    )
  );

-- PORTAL_ROCKS
CREATE POLICY "Members can manage rocks of their plans"
  ON public.portal_rocks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portal_plans p
      WHERE p.id = plan_id AND public.is_portal_company_member(auth.uid(), p.company_id)
    )
  );

-- PORTAL_PRODUCT_CATALOG
CREATE POLICY "Anyone can view active products"
  ON public.portal_product_catalog FOR SELECT
  USING (is_active = true);

CREATE POLICY "UNV admins can manage product catalog"
  ON public.portal_product_catalog FOR ALL
  USING (public.is_portal_admin_unv(auth.uid()));

-- PORTAL_CHAT_LOGS
CREATE POLICY "Users can manage their own chat logs"
  ON public.portal_chat_logs FOR ALL
  USING (user_id IN (SELECT id FROM public.portal_users WHERE user_id = auth.uid()));

CREATE POLICY "UNV admins can view all chat logs"
  ON public.portal_chat_logs FOR SELECT
  USING (public.is_portal_admin_unv(auth.uid()));

-- PORTAL_AUDIT_LOGS
CREATE POLICY "Company members can view their audit logs"
  ON public.portal_audit_logs FOR SELECT
  USING (company_id = public.get_portal_company_id(auth.uid()));

CREATE POLICY "UNV admins can view all audit logs"
  ON public.portal_audit_logs FOR SELECT
  USING (public.is_portal_admin_unv(auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON public.portal_audit_logs FOR INSERT
  WITH CHECK (true);

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.portal_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_portal_companies_updated_at
  BEFORE UPDATE ON public.portal_companies
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_portal_users_updated_at
  BEFORE UPDATE ON public.portal_users
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_portal_plans_updated_at
  BEFORE UPDATE ON public.portal_plans
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_portal_north_stars_updated_at
  BEFORE UPDATE ON public.portal_north_stars
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_portal_objectives_updated_at
  BEFORE UPDATE ON public.portal_objectives
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_portal_key_results_updated_at
  BEFORE UPDATE ON public.portal_key_results
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_portal_initiatives_updated_at
  BEFORE UPDATE ON public.portal_initiatives
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_portal_rocks_updated_at
  BEFORE UPDATE ON public.portal_rocks
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_portal_chat_logs_updated_at
  BEFORE UPDATE ON public.portal_chat_logs
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();