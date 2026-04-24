
-- ============================================================
-- Módulo Meta Ads no CRM Comercial (escopado por tenant)
-- ============================================================

-- 1) Conta Meta Ads conectada ao CRM (uma por tenant; tenant_id NULL = master UNV)
CREATE TABLE public.crm_meta_ads_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  ad_account_name text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  is_connected boolean NOT NULL DEFAULT true,
  connected_by uuid REFERENCES auth.users(id),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ad_account_id)
);

CREATE UNIQUE INDEX crm_meta_ads_accounts_one_per_tenant
  ON public.crm_meta_ads_accounts (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_connected = true;

-- 2) Campanhas
CREATE TABLE public.crm_meta_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.crm_meta_ads_accounts(id) ON DELETE CASCADE,
  campaign_id text NOT NULL,
  campaign_name text,
  status text,
  objective text,
  daily_budget numeric,
  lifetime_budget numeric,
  impressions bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  spend numeric(12,2) DEFAULT 0,
  cpc numeric(10,4) DEFAULT 0,
  cpm numeric(10,4) DEFAULT 0,
  ctr numeric(10,4) DEFAULT 0,
  conversions integer DEFAULT 0,
  conversion_value numeric(12,2) DEFAULT 0,
  leads integer DEFAULT 0,
  frequency numeric(10,4) DEFAULT 0,
  date_start date,
  date_stop date,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, campaign_id, date_start, date_stop)
);
CREATE INDEX idx_crm_meta_campaigns_tenant ON public.crm_meta_ads_campaigns(tenant_id);
CREATE INDEX idx_crm_meta_campaigns_account ON public.crm_meta_ads_campaigns(account_id);
CREATE INDEX idx_crm_meta_campaigns_dates ON public.crm_meta_ads_campaigns(date_start, date_stop);

-- 3) Adsets
CREATE TABLE public.crm_meta_ads_adsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.crm_meta_ads_accounts(id) ON DELETE CASCADE,
  adset_id text NOT NULL,
  adset_name text,
  campaign_id text,
  campaign_name text,
  status text,
  daily_budget numeric,
  impressions bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  spend numeric(12,2) DEFAULT 0,
  cpc numeric(10,4) DEFAULT 0,
  cpm numeric(10,4) DEFAULT 0,
  ctr numeric(10,4) DEFAULT 0,
  conversions integer DEFAULT 0,
  conversion_value numeric(12,2) DEFAULT 0,
  leads integer DEFAULT 0,
  frequency numeric(10,4) DEFAULT 0,
  date_start date,
  date_stop date,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, adset_id, date_start, date_stop)
);
CREATE INDEX idx_crm_meta_adsets_tenant ON public.crm_meta_ads_adsets(tenant_id);
CREATE INDEX idx_crm_meta_adsets_campaign ON public.crm_meta_ads_adsets(campaign_id);

-- 4) Ads (criativos)
CREATE TABLE public.crm_meta_ads_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.crm_meta_ads_accounts(id) ON DELETE CASCADE,
  ad_id text NOT NULL,
  ad_name text,
  adset_id text,
  adset_name text,
  campaign_id text,
  campaign_name text,
  status text,
  creative_thumbnail_url text,
  creative_body text,
  creative_title text,
  creative_link_url text,
  impressions bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  spend numeric(12,2) DEFAULT 0,
  cpc numeric(10,4) DEFAULT 0,
  cpm numeric(10,4) DEFAULT 0,
  ctr numeric(10,4) DEFAULT 0,
  conversions integer DEFAULT 0,
  conversion_value numeric(12,2) DEFAULT 0,
  leads integer DEFAULT 0,
  frequency numeric(10,4) DEFAULT 0,
  date_start date,
  date_stop date,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, ad_id, date_start, date_stop)
);
CREATE INDEX idx_crm_meta_ads_tenant ON public.crm_meta_ads_ads(tenant_id);
CREATE INDEX idx_crm_meta_ads_campaign ON public.crm_meta_ads_ads(campaign_id);

-- 5) Vínculo N:N campanha ↔ funil (totalmente personalizável)
CREATE TABLE public.crm_meta_campaign_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.crm_meta_ads_accounts(id) ON DELETE CASCADE,
  campaign_id text NOT NULL,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  weight numeric(5,4) NOT NULL DEFAULT 1.0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, campaign_id, pipeline_id)
);
CREATE INDEX idx_crm_meta_camp_pipe_pipeline ON public.crm_meta_campaign_pipelines(pipeline_id);
CREATE INDEX idx_crm_meta_camp_pipe_campaign ON public.crm_meta_campaign_pipelines(account_id, campaign_id);

-- ============================================================
-- Triggers updated_at
-- ============================================================
CREATE TRIGGER trg_crm_meta_ads_accounts_updated_at
  BEFORE UPDATE ON public.crm_meta_ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Triggers de tenant_id (mesma função usada pelo CRM)
-- ============================================================
CREATE TRIGGER trg_set_tenant_id_crm_meta_accounts
  BEFORE INSERT ON public.crm_meta_ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER trg_set_tenant_id_crm_meta_campaigns
  BEFORE INSERT ON public.crm_meta_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER trg_set_tenant_id_crm_meta_adsets
  BEFORE INSERT ON public.crm_meta_ads_adsets
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER trg_set_tenant_id_crm_meta_ads
  BEFORE INSERT ON public.crm_meta_ads_ads
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER trg_set_tenant_id_crm_meta_camp_pipe
  BEFORE INSERT ON public.crm_meta_campaign_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.crm_meta_ads_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_meta_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_meta_ads_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_meta_ads_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_meta_campaign_pipelines ENABLE ROW LEVEL SECURITY;

-- Accounts: admins do CRM gerenciam, usuários do CRM visualizam
CREATE POLICY "CRM users view meta accounts"
  ON public.crm_meta_ads_accounts FOR SELECT TO authenticated
  USING (public.has_crm_access() AND public.tenant_matches(tenant_id));

CREATE POLICY "CRM admins manage meta accounts"
  ON public.crm_meta_ads_accounts FOR ALL TO authenticated
  USING (public.is_crm_admin() AND public.tenant_matches(tenant_id))
  WITH CHECK (public.is_crm_admin() AND public.tenant_matches(tenant_id));

-- Campaigns/adsets/ads: leitura para usuários CRM, gestão para admin/service
CREATE POLICY "CRM users view meta campaigns"
  ON public.crm_meta_ads_campaigns FOR SELECT TO authenticated
  USING (public.has_crm_access() AND public.tenant_matches(tenant_id));
CREATE POLICY "CRM admins manage meta campaigns"
  ON public.crm_meta_ads_campaigns FOR ALL TO authenticated
  USING (public.is_crm_admin() AND public.tenant_matches(tenant_id))
  WITH CHECK (public.is_crm_admin() AND public.tenant_matches(tenant_id));

CREATE POLICY "CRM users view meta adsets"
  ON public.crm_meta_ads_adsets FOR SELECT TO authenticated
  USING (public.has_crm_access() AND public.tenant_matches(tenant_id));
CREATE POLICY "CRM admins manage meta adsets"
  ON public.crm_meta_ads_adsets FOR ALL TO authenticated
  USING (public.is_crm_admin() AND public.tenant_matches(tenant_id))
  WITH CHECK (public.is_crm_admin() AND public.tenant_matches(tenant_id));

CREATE POLICY "CRM users view meta ads"
  ON public.crm_meta_ads_ads FOR SELECT TO authenticated
  USING (public.has_crm_access() AND public.tenant_matches(tenant_id));
CREATE POLICY "CRM admins manage meta ads"
  ON public.crm_meta_ads_ads FOR ALL TO authenticated
  USING (public.is_crm_admin() AND public.tenant_matches(tenant_id))
  WITH CHECK (public.is_crm_admin() AND public.tenant_matches(tenant_id));

-- Vínculos campanha-funil
CREATE POLICY "CRM users view campaign-pipeline links"
  ON public.crm_meta_campaign_pipelines FOR SELECT TO authenticated
  USING (public.has_crm_access() AND public.tenant_matches(tenant_id));
CREATE POLICY "CRM admins manage campaign-pipeline links"
  ON public.crm_meta_campaign_pipelines FOR ALL TO authenticated
  USING (public.is_crm_admin() AND public.tenant_matches(tenant_id))
  WITH CHECK (public.is_crm_admin() AND public.tenant_matches(tenant_id));
