ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS provider_type text NOT NULL DEFAULT 'evolution'
CHECK (provider_type IN ('evolution', 'manager_v2'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_provider_type
ON public.whatsapp_instances(provider_type);

COMMENT ON COLUMN public.whatsapp_instances.provider_type IS
'Provider backend: evolution (Evolution API tradicional) ou manager_v2 (Stevo Manager V2 - Go/whatsmeow)';