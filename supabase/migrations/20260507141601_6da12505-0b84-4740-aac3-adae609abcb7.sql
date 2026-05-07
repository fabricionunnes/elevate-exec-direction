-- Tabela de histórico de sincronizações Asaas
CREATE TABLE IF NOT EXISTS public.asaas_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  window_days int NOT NULL,
  processed int NOT NULL DEFAULT 0,
  credited int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  divergences int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0,
  summary jsonb
);

ALTER TABLE public.asaas_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can view sync runs"
ON public.asaas_sync_runs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.email = 'fabricio@universidadevendas.com.br'
  )
);

CREATE INDEX IF NOT EXISTS idx_asaas_sync_runs_ran_at ON public.asaas_sync_runs(ran_at DESC);
