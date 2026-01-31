-- Add API URL and API Key columns to whatsapp_instances for per-instance configuration
ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS api_url text,
ADD COLUMN IF NOT EXISTS api_key text;

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_instances.api_url IS 'Custom Evolution API URL for this instance';
COMMENT ON COLUMN public.whatsapp_instances.api_key IS 'Custom Evolution API Key for this instance';