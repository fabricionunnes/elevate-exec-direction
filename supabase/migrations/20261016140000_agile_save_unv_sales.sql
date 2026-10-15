-- Agile Save: Faturamento no Nexus vem do CRM UNV Sales (nexus-kpi-sync, de hora em hora), 16/10/2026.
-- Fabrício: "pode confiar no que está no CRM". Desde 11/09 (início do uso do CRM) o manual de
-- Faturamento foi zerado (backup local backup_agile_faturamento_manual_20261016.json) e o CRM
-- reescreveu o período. Antes de 11/09 continua o lançamento manual.
create or replace view public.company_kpi_integrations as
 SELECT datacrazy_sync_configs.company_id, 'Datacrazy'::text AS source
   FROM datacrazy_sync_configs WHERE datacrazy_sync_configs.enabled
UNION ALL
 SELECT kommo_sync_configs.company_id, 'Kommo'::text AS source
   FROM kommo_sync_configs WHERE kommo_sync_configs.enabled
UNION ALL
 SELECT fixas.company_id, fixas.source
   FROM ( VALUES ('6e94acf4-4888-4c1c-bacd-0861ced43a87'::uuid,'Agendor'::text),
                 ('7bae5004-0493-4186-974d-aa2710a7cf78'::uuid,'WinDash'::text),
                 ('8ec159d5-c560-4556-85e5-b69a04bc7f21'::uuid,'Bitrix24'::text),
                 ('2f7c4597-1943-4ded-ad7c-0f0ac3a82ae9'::uuid,'UNV Sales'::text),
                 ('c4194510-1090-47ac-bd09-be8fe04718ca'::uuid,'UNV Sales'::text)) fixas(company_id, source);
