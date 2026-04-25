
-- Adiciona colunas para rastreio granular de leads vindos de tráfego pago
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS meta_campaign_id text,
  ADD COLUMN IF NOT EXISTS meta_adset_id text,
  ADD COLUMN IF NOT EXISTS meta_ad_id text;

CREATE INDEX IF NOT EXISTS idx_crm_leads_meta_campaign_id ON public.crm_leads (meta_campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_meta_adset_id ON public.crm_leads (meta_adset_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_meta_ad_id ON public.crm_leads (meta_ad_id);
