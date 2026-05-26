-- Tabelas para matrículas da Facunicamps

CREATE TABLE IF NOT EXISTS facunicamps_matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '1081cb78-bd6c-42b2-8a85-104ead3ecc18',
  data_venda date,
  vendedor text,
  cliente text,
  forma_ingresso text,
  modalidade text,
  curso text,
  valor_matricula numeric(10,2),
  valor_total numeric(10,2),
  row_index integer,
  imported_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facunicamps_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  rows_imported integer,
  status text DEFAULT 'running', -- running, success, error
  error_message text
);

-- pg_cron: sincroniza diariamente às 06:00 UTC (03:00 BRT)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'facunicamps-sync-daily';

SELECT cron.schedule(
  'facunicamps-sync-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/facunicamps-sync',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
