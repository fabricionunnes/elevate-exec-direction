-- Grant SELECT on tenant_integration_secrets to all roles used by PostgREST/Edge Functions.
-- Without this, service_role gets 42501 when querying the table via the JS client.
GRANT SELECT ON tenant_integration_secrets TO service_role;
GRANT SELECT ON tenant_integration_secrets TO authenticated;
GRANT SELECT ON tenant_integration_secrets TO anon;
