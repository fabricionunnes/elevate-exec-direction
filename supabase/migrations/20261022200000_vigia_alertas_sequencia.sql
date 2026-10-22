-- O vigia de lead esperando (ai-health-check) grava "já avisei" em crm_agent_silence_alerts, mas o
-- service_role não tinha permissão no contador do id: toda gravação falhava calada e o aviso se
-- repetia a cada 30 minutos (22/10/2026).
grant usage, select on sequence public.crm_agent_silence_alerts_id_seq to service_role;
