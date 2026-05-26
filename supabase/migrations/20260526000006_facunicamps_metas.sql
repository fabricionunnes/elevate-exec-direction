CREATE TABLE facunicamps_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL UNIQUE, -- first day of the month: 2025-01-01
  meta integer NOT NULL DEFAULT 0,
  super integer NOT NULL DEFAULT 0,
  hiper integer NOT NULL DEFAULT 0,
  atendimentos integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT ALL ON facunicamps_metas TO service_role;
GRANT SELECT, INSERT, UPDATE ON facunicamps_metas TO authenticated;
ALTER TABLE facunicamps_metas DISABLE ROW LEVEL SECURITY;
