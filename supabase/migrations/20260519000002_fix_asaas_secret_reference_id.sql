-- Ensure reference_id is set correctly in tenant_integration_secrets for all Asaas accounts.
-- tenant-asaas-account should have set this, but may have been missing for manually-inserted rows.
-- This JOIN updates any row where reference_id is NULL or mismatched.
UPDATE tenant_integration_secrets tis
SET reference_id = aa.id
FROM asaas_accounts aa
WHERE tis.provider = 'asaas'
  AND tis.secret_name = aa.api_key_secret_name
  AND (tis.reference_id IS NULL OR tis.reference_id != aa.id);
