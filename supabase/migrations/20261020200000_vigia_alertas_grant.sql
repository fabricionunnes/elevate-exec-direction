-- O vigia "lead esperando" (ai-health-check) não conseguia ler nem gravar o registro de "já avisei":
-- a tabela ficou sem grant pra service_role e o mesmo lead era avisado a cada 30 min (20/10/2026).
grant select, insert, update, delete on public.crm_agent_silence_alerts to service_role;
