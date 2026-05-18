-- Add bank_id column to asaas_accounts so each Asaas account can be linked
-- to a specific internal bank account (financial_banks) for automatic reconciliation.
ALTER TABLE asaas_accounts
  ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES financial_banks(id) ON DELETE SET NULL;

-- Also ensure tenant_integration_secrets table exists (created in a prior migration,
-- but guard here so this migration is idempotent)
CREATE TABLE IF NOT EXISTS tenant_integration_secrets (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL,
  secret_name   TEXT NOT NULL,
  secret_value  TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'asaas',
  reference_id  UUID,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, secret_name)
);

-- RLS: only service role can read/write secrets
ALTER TABLE tenant_integration_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON tenant_integration_secrets;
CREATE POLICY "service_role_all" ON tenant_integration_secrets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
