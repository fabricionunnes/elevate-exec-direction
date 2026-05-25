-- Tabela de conexão Meta Ads para os agentes UNV (Luna/Max)
-- Independente do módulo de onboarding — sem project_id obrigatório

CREATE TABLE IF NOT EXISTS public.unv_meta_ads_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id TEXT NOT NULL UNIQUE,
  ad_account_name TEXT,
  access_token TEXT NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.unv_meta_ads_accounts ENABLE ROW LEVEL SECURITY;

-- Permite leitura e escrita para service role (edge functions)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unv_meta_ads_accounts' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access"
      ON public.unv_meta_ads_accounts FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Permite leitura para authenticated (anon não precisa ver tokens)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unv_meta_ads_accounts' AND policyname = 'Anon can read connection status') THEN
    CREATE POLICY "Anon can read connection status"
      ON public.unv_meta_ads_accounts FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
