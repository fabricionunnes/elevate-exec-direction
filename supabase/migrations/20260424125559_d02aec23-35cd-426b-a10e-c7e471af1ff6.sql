ALTER TABLE public.crm_pipelines ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Inicializar sort_order para pipelines existentes baseado em created_at
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY is_default DESC, created_at) - 1 AS rn
  FROM public.crm_pipelines
)
UPDATE public.crm_pipelines p
SET sort_order = o.rn
FROM ordered o
WHERE p.id = o.id;

CREATE INDEX IF NOT EXISTS idx_crm_pipelines_sort_order ON public.crm_pipelines(tenant_id, sort_order);