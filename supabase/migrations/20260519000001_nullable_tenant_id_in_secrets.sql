-- Allow platform-level secrets (no tenant_id) in tenant_integration_secrets.
-- The previous schema required tenant_id NOT NULL, which silently dropped secrets
-- created by the master UNV admin (who has no tenant_id).

-- 1. Drop existing UNIQUE constraint that includes tenant_id
ALTER TABLE tenant_integration_secrets
  DROP CONSTRAINT IF EXISTS tenant_integration_secrets_tenant_id_secret_name_key;

-- 2. Make tenant_id nullable
ALTER TABLE tenant_integration_secrets
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 3. Re-create UNIQUE constraint that works with nullable tenant_id
--    Two platform secrets with the same secret_name should still be unique.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_integration_secrets_unique_idx
  ON tenant_integration_secrets (
    COALESCE(tenant_id::text, ''), secret_name
  );
