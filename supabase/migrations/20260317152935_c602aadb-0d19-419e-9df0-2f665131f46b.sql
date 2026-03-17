
-- Add unique constraint on tenant_id for upsert in whitelabel_subscriptions
ALTER TABLE public.whitelabel_subscriptions ADD CONSTRAINT whitelabel_subscriptions_tenant_id_key UNIQUE (tenant_id);

-- Create storage bucket for whitelabel assets
INSERT INTO storage.buckets (id, name, public) VALUES ('whitelabel-assets', 'whitelabel-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: tenant admins can upload to their folder
CREATE POLICY "Tenant admins can upload assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'whitelabel-assets'
  AND (storage.foldername(name))[1] = 'whitelabel'
  AND public.is_tenant_member((storage.foldername(name))[2]::uuid)
);

CREATE POLICY "Anyone can view whitelabel assets"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'whitelabel-assets');
