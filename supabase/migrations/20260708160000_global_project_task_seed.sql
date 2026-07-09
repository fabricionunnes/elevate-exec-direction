-- Tarefas padrão em TODO projeto novo (pedido do Fabrício, 2026-07-08).
-- 15 templates com product_id='global' (prazos em dias a partir da criação do
-- projeto) + trigger AFTER INSERT em onboarding_projects que as semeia.
-- Trigger no banco = pega QUALQUER caminho de criação (tela Novo Projeto, lead
-- ganho, webhooks, API), sem depender do front.
-- Recorrência (Contato mensal, DISC/360 e Revisão 90d) usa o mecanismo NATIVO
-- já existente: create_next_recurring_task() dispara ao concluir e cria a
-- próxima ocorrência em dias úteis, respeitando projeto/empresa ativos.

insert into onboarding_task_templates
  (product_id, title, default_days_offset, sort_order, priority, phase, phase_order, recurrence, is_internal)
values
  ('global','Criar grupo de gestão',            1, 1,'high',  'Jornada UNV',99,null,       true),
  ('global','Dar boas-vindas',                  1, 2,'high',  'Jornada UNV',99,null,       true),
  ('global','Lançar briefing/Instagram',        1, 3,'medium','Jornada UNV',99,null,       true),
  ('global','Contrato',                         1, 4,'high',  'Jornada UNV',99,null,       true),
  ('global','Agendar/realizar onboarding',      2, 5,'high',  'Jornada UNV',99,null,       true),
  ('global','Envio de formulário de kick off',  2, 6,'medium','Jornada UNV',99,null,       true),
  ('global','Coletar meta no onboarding',       4, 7,'high',  'Jornada UNV',99,null,       true),
  ('global','Passagem de bastão ao consultor',  4, 8,'high',  'Jornada UNV',99,null,       true),
  ('global','DISC/360',                         5, 9,'medium','Jornada UNV',99,'quarterly',true),
  ('global','Criação CRM',                      7,10,'medium','Jornada UNV',99,null,       true),
  ('global','Acesso Nexus',                     7,11,'medium','Jornada UNV',99,null,       true),
  ('global','Análise de tráfego',              15,12,'medium','Jornada UNV',99,null,       true),
  ('global','Análise de rede social',          20,13,'medium','Jornada UNV',99,null,       true),
  ('global','Contato mensal',                  30,14,'medium','Jornada UNV',99,'monthly',  true),
  ('global','Revisão estratégica 90 dias',     90,15,'medium','Jornada UNV',99,'quarterly',true)
on conflict do nothing;

create or replace function seed_global_project_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into onboarding_tasks
    (project_id, template_id, title, description, priority, status, due_date,
     sort_order, tags, recurrence, is_internal)
  select
    new.id, t.id, t.title, t.description, coalesce(t.priority,'medium'), 'pending',
    (current_date + make_interval(days => greatest(coalesce(t.default_days_offset,0),0)))::date,
    coalesce(t.sort_order,0),
    case when t.phase is not null then array[t.phase] else null end,
    t.recurrence, coalesce(t.is_internal,false)
  from onboarding_task_templates t
  where t.product_id = 'global'
  order by t.sort_order;
  return new;
end $$;

drop trigger if exists trg_seed_global_project_tasks on onboarding_projects;
create trigger trg_seed_global_project_tasks
  after insert on onboarding_projects
  for each row execute function seed_global_project_tasks();
