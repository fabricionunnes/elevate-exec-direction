-- Tabelas criadas via Management API não herdam default privileges:
-- sem estes grants a edge function (service_role) lia lista vazia de pilares.
grant select, insert, update, delete on curriculum_pillars, curriculum_items,
  project_curriculum_items, project_report_cards to service_role, anon;
