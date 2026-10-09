-- Edge Functions com a chave de serviço precisam de privilégio nas tabelas do schema
-- (service_role ignora RLS, mas não ignora GRANT). Faltava desde a criação do schema.
grant select, insert, update, delete on all tables in schema yasfood to service_role;
grant usage, select on all sequences in schema yasfood to service_role;
grant execute on all functions in schema yasfood to service_role;
alter default privileges in schema yasfood grant select, insert, update, delete on tables to service_role;
alter default privileges in schema yasfood grant usage, select on sequences to service_role;
alter default privileges in schema yasfood grant execute on functions to service_role;
