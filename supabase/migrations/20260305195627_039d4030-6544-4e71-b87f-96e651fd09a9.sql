
-- Table: crm_clint_config
CREATE TABLE public.crm_clint_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_token_secret_name text NOT NULL DEFAULT 'CLINT_API_TOKEN',
  webhook_secret text,
  sync_enabled boolean NOT NULL DEFAULT false,
  sync_direction text NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'clint_to_crm', 'crm_to_clint')),
  default_pipeline_id uuid REFERENCES public.crm_pipelines(id),
  default_stage_id uuid REFERENCES public.crm_stages(id),
  pipeline_mapping jsonb DEFAULT '{}',
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_clint_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM admins can manage clint config"
ON public.crm_clint_config
FOR ALL
TO authenticated
USING (public.is_crm_admin())
WITH CHECK (public.is_crm_admin());

-- Table: crm_clint_sync_log
CREATE TABLE public.crm_clint_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  clint_contact_id text,
  clint_deal_id text,
  sync_direction text NOT NULL CHECK (sync_direction IN ('clint_to_crm', 'crm_to_clint')),
  sync_status text NOT NULL DEFAULT 'success' CHECK (sync_status IN ('success', 'error', 'pending')),
  error_message text,
  payload jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_clint_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM admins can view sync log"
ON public.crm_clint_sync_log
FOR SELECT
TO authenticated
USING (public.has_crm_access());

CREATE POLICY "CRM admins can manage sync log"
ON public.crm_clint_sync_log
FOR ALL
TO authenticated
USING (public.is_crm_admin())
WITH CHECK (public.is_crm_admin());

-- Index for fast lookups
CREATE INDEX idx_clint_sync_crm_lead ON public.crm_clint_sync_log(crm_lead_id);
CREATE INDEX idx_clint_sync_contact ON public.crm_clint_sync_log(clint_contact_id);
CREATE INDEX idx_clint_sync_deal ON public.crm_clint_sync_log(clint_deal_id);

-- Check if is_crm_admin function exists (it should from existing CRM setup)
-- The function is already defined in the database
