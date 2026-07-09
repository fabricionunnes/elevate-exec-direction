-- Manual de Processos UNV — base de conhecimento interna (staff only)
CREATE TABLE IF NOT EXISTS public.staff_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  sector text NOT NULL,
  roles text[] NOT NULL DEFAULT '{}'::text[],
  summary text,
  content text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_processes_sector ON public.staff_processes(sector);

ALTER TABLE public.staff_processes ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer staff UNV ativo (tenant master). Staff white-label de clientes não enxerga.
CREATE POLICY "Staff UNV ativo pode ler processos"
  ON public.staff_processes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true AND tenant_id IS NULL
  ));

-- Escrita: apenas master/admin da UNV
CREATE POLICY "Master e admin podem criar processos"
  ON public.staff_processes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true AND tenant_id IS NULL
      AND role IN ('master','admin')
  ));

CREATE POLICY "Master e admin podem atualizar processos"
  ON public.staff_processes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true AND tenant_id IS NULL
      AND role IN ('master','admin')
  ));

CREATE POLICY "Master e admin podem excluir processos"
  ON public.staff_processes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true AND tenant_id IS NULL
      AND role IN ('master','admin')
  ));

CREATE TRIGGER staff_processes_updated_at
  BEFORE UPDATE ON public.staff_processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants explícitos (criação via Management API não herda os defaults do Supabase).
-- Acesso por linha continua governado pelas policies acima; anon fica sem nada.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_processes TO authenticated;
