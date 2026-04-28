ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_pipeline_id_fkey;
ALTER TABLE public.crm_leads ADD CONSTRAINT crm_leads_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.crm_pipelines(id) ON DELETE CASCADE;

ALTER TABLE public.crm_sales DROP CONSTRAINT IF EXISTS crm_sales_pipeline_id_fkey;
ALTER TABLE public.crm_sales ADD CONSTRAINT crm_sales_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.crm_pipelines(id) ON DELETE SET NULL;

ALTER TABLE public.crm_clint_config DROP CONSTRAINT IF EXISTS crm_clint_config_default_pipeline_id_fkey;
ALTER TABLE public.crm_clint_config ADD CONSTRAINT crm_clint_config_default_pipeline_id_fkey FOREIGN KEY (default_pipeline_id) REFERENCES public.crm_pipelines(id) ON DELETE SET NULL;