CREATE INDEX IF NOT EXISTS idx_crm_leads_pipeline_origin_created 
ON public.crm_leads (pipeline_id, origin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_lead_tags_lead_id 
ON public.crm_lead_tags (lead_id);