-- Add unique constraint on integration_type for upsert to work
ALTER TABLE public.financial_integrations 
ADD CONSTRAINT financial_integrations_integration_type_key UNIQUE (integration_type);