-- Fecha vazamento de tenant no CRM multi-tenant (rumo ao CRM do cliente / white-label).
-- crm_leads/pipelines/stages já tinham policy RESTRICTIVE de tenant, mas 11 tabelas
-- com coluna tenant_id NÃO tinham — incluindo as mais sensíveis: gravações de ligação
-- (crm_calls), discador (crm_dialer_*) e contas de anúncio com token (crm_meta_ads_*).
-- Sem isso, um cliente-tenant (criado como role 'master' com tenant) veria os dados
-- da UNV (tenant_id NULL). Dados da UNV nessas tabelas são tenant NULL, então a policy
-- restritiva tenant_matches() mantém a UNV vendo os dela e clampa o cliente ao tenant dele.
do $$
declare
  t text;
  tbls text[] := array[
    'crm_calls','crm_dialer_campaigns','crm_dialer_queue','crm_dialer_sessions',
    'crm_cadences','crm_cadence_enrollments','crm_meta_ads_accounts',
    'crm_meta_ads_campaigns','crm_meta_ads_adsets','crm_meta_ads_ads','crm_meta_campaign_pipelines'
  ];
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_iso_restrict on public.%I', t);
    execute format(
      'create policy tenant_iso_restrict on public.%I as restrictive for all using (public.tenant_matches(tenant_id)) with check (public.tenant_matches(tenant_id))',
      t
    );
  end loop;
end $$;

-- PENDENTE (não incluído aqui — exige auditoria cuidadosa pra não quebrar a UNV):
-- tabelas por-lead/config sem coluna tenant que hoje têm policy permissiva aberta
-- (crm_activities, crm_sales, crm_lead_proposals, crm_custom_field_values, crm_products, ...)
-- vazam entre tenants. Precisam isolar via o lead/pipeline (tenant do pai) ou ganhar
-- tenant_id + policy restritiva ANTES de qualquer cliente real usar o CRM.
