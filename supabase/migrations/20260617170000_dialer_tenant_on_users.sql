-- Opção B: tenant do discador separado do tenant do portal (não quebra acesso do cliente)
ALTER TABLE public.onboarding_users ADD COLUMN IF NOT EXISTS dialer_tenant_id uuid REFERENCES public.whitelabel_tenants(id);
