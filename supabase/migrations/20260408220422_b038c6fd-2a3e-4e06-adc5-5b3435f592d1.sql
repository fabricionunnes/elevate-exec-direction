
-- Composite index for the main query pattern: project_id + pipeline_id + created_at
CREATE INDEX IF NOT EXISTS idx_client_crm_leads_pipeline_created 
  ON public.client_crm_leads (project_id, pipeline_id, created_at DESC);

-- Composite index for origin filtering
CREATE INDEX IF NOT EXISTS idx_client_crm_leads_pipeline_origin 
  ON public.client_crm_leads (project_id, pipeline_id, origin_id, created_at DESC);

-- Index on lead_tags for join performance
CREATE INDEX IF NOT EXISTS idx_client_crm_lead_tags_lead 
  ON public.client_crm_lead_tags (lead_id);

-- Index on stages by pipeline
CREATE INDEX IF NOT EXISTS idx_client_crm_stages_pipeline 
  ON public.client_crm_stages (pipeline_id, sort_order);
