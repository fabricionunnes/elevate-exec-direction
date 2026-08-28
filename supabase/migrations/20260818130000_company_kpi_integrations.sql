-- Registro unificado de "quais empresas têm KPI alimentado automaticamente por CRM".
-- Fontes com config em tabela (Datacrazy, Kommo) entram sozinhas; integrações com
-- empresa fixa no código da edge (Agendor/3D Cure, WinDash/Kapitao, Bitrix/2M)
-- ficam nas linhas estáticas — nova integração hardcoded = adicionar linha aqui.
create or replace view public.company_kpi_integrations
with (security_invoker = true) as
  select company_id, 'Datacrazy'::text as source from public.datacrazy_sync_configs where enabled
  union all
  select company_id, 'Kommo'::text from public.kommo_sync_configs where enabled
  union all
  select * from (values
    ('6e94acf4-4888-4c1c-bacd-0861ced43a87'::uuid, 'Agendor'::text),   -- 3D Cure
    ('7bae5004-0493-4186-974d-aa2710a7cf78'::uuid, 'WinDash'::text),   -- Kapitao America
    ('8ec159d5-c560-4556-85e5-b69a04bc7f21'::uuid, 'Bitrix24'::text)   -- 2M Gestão
  ) as fixas(company_id, source);

grant select on public.company_kpi_integrations to authenticated, service_role;
