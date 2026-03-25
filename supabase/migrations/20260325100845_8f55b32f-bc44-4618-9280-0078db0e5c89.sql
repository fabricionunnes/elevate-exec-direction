
-- Table to store API keys for external integrations
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only staff with master/admin role can manage API keys
CREATE POLICY "Staff can manage api_keys"
ON public.api_keys FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role IN ('master', 'admin')
  )
);
