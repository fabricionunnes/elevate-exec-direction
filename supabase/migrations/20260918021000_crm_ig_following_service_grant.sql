-- 18/09/2026: crm_ig_following não tinha GRANT pra service_role → o motor do agente (crm-agent-respond) recebia 403
-- e a regra 'não responder quem o Fabrício segue' nunca funcionou (rodvincenzi, escolaserradamoeda, opaidamoto foram respondidos).
grant select on public.crm_ig_following to service_role;
