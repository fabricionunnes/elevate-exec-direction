-- API keys por tenant para entrada de leads via API (conectar qualquer CRM/funil do cliente).
CREATE TABLE IF NOT EXISTS public.dialer_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,  -- NULL = UNV
  api_key TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE public.dialer_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope_dialer_api_keys ON public.dialer_api_keys;
CREATE POLICY tenant_scope_dialer_api_keys ON public.dialer_api_keys FOR ALL
USING (
  CASE
    WHEN public.is_master_user() THEN (tenant_id IS NULL)
    WHEN public.current_user_tenant_id() IS NOT NULL THEN (tenant_id = public.current_user_tenant_id())
    ELSE true
  END
)
WITH CHECK (
  CASE
    WHEN public.is_master_user() THEN (tenant_id IS NULL)
    WHEN public.current_user_tenant_id() IS NOT NULL THEN ((tenant_id = public.current_user_tenant_id()) OR (tenant_id IS NULL))
    ELSE true
  END
);
GRANT ALL ON public.dialer_api_keys TO anon, authenticated, service_role;

-- gera uma chave nova (helper); retorna a chave em texto
CREATE OR REPLACE FUNCTION public.dialer_generate_api_key(p_tenant UUID, p_label TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key TEXT;
BEGIN
  v_key := 'dlk_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.dialer_api_keys (tenant_id, api_key, label) VALUES (p_tenant, v_key, p_label);
  RETURN v_key;
END; $$;
GRANT EXECUTE ON FUNCTION public.dialer_generate_api_key(UUID, TEXT) TO authenticated, service_role;
