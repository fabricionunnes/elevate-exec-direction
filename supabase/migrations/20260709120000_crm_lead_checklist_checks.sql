-- "Progresso da etapa" (checklist do lead no CRM) era salvo em localStorage —
-- a SDR marcava e NINGUÉM MAIS via (nem ela em outro computador). Esta tabela
-- persiste as marcações no banco, compartilhadas por toda a equipe.
create table if not exists crm_lead_checklist_checks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references crm_leads(id) on delete cascade,
  item_id uuid not null references crm_stage_checklists(id) on delete cascade,
  checked_by uuid default auth.uid(),
  tenant_id uuid,
  created_at timestamptz not null default now(),
  unique (lead_id, item_id)
);

alter table crm_lead_checklist_checks enable row level security;
grant all on table crm_lead_checklist_checks to service_role;
grant select, insert, update, delete on table crm_lead_checklist_checks to authenticated;

drop policy if exists checks_crm_access on crm_lead_checklist_checks;
create policy checks_crm_access on crm_lead_checklist_checks
  for all to authenticated
  using (has_crm_access())
  with check (has_crm_access());

-- padrão multi-tenant do CRM (cliente white-label não enxerga checks da UNV)
drop policy if exists tenant_iso_restrict on crm_lead_checklist_checks;
create policy tenant_iso_restrict on crm_lead_checklist_checks
  as restrictive for all
  using (tenant_matches(tenant_id))
  with check (tenant_matches(tenant_id));
