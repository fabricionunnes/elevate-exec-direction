-- Grade Curricular dos serviços UNV + Boletim da empresa (notas por pilar)
-- Fluxo: cliente fecha → IA lê o briefing e monta a grade do projeto (gera
-- tarefas na Jornada) → boletim mensal dá nota 0-10 por pilar, atualizado
-- pela IA (botão + cron semanal) com ajuste manual do consultor.

-- ── Pilares (globais) ─────────────────────────────────────────────────────
create table if not exists curriculum_pillars (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Itens padrão da grade (globais) ───────────────────────────────────────
create table if not exists curriculum_items (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references curriculum_pillars(id) on delete cascade,
  title text not null,
  description text,
  default_week int not null default 1, -- semana sugerida a partir do início
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Grade instanciada por projeto ─────────────────────────────────────────
create table if not exists project_curriculum_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references onboarding_projects(id) on delete cascade,
  pillar_id uuid not null references curriculum_pillars(id),
  item_id uuid references curriculum_items(id), -- null = item criado pela IA pro cliente
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','done','na')),
  due_date date,
  task_id uuid references onboarding_tasks(id) on delete set null,
  source text not null default 'padrao' check (source in ('padrao','briefing')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_proj_curriculum_project on project_curriculum_items(project_id);

-- ── Boletim mensal por pilar ──────────────────────────────────────────────
create table if not exists project_report_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references onboarding_projects(id) on delete cascade,
  period text not null, -- 'YYYY-MM'
  pillar_id uuid not null references curriculum_pillars(id),
  score numeric(4,1) not null check (score >= 0 and score <= 10),
  commentary text,
  graded_by text not null default 'ia', -- 'ia' | nome do staff (ajuste manual)
  updated_at timestamptz not null default now(),
  unique (project_id, period, pillar_id)
);
create index if not exists idx_report_cards_project on project_report_cards(project_id, period);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table curriculum_pillars enable row level security;
alter table curriculum_items enable row level security;
alter table project_curriculum_items enable row level security;
alter table project_report_cards enable row level security;

drop policy if exists curriculum_pillars_staff on curriculum_pillars;
create policy curriculum_pillars_staff on curriculum_pillars for all
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active));
drop policy if exists curriculum_pillars_read on curriculum_pillars;
create policy curriculum_pillars_read on curriculum_pillars for select
  using (auth.uid() is not null);

drop policy if exists curriculum_items_staff on curriculum_items;
create policy curriculum_items_staff on curriculum_items for all
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active));
drop policy if exists curriculum_items_read on curriculum_items;
create policy curriculum_items_read on curriculum_items for select
  using (auth.uid() is not null);

drop policy if exists proj_curriculum_staff on project_curriculum_items;
create policy proj_curriculum_staff on project_curriculum_items for all
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active));
drop policy if exists proj_curriculum_client on project_curriculum_items;
create policy proj_curriculum_client on project_curriculum_items for select
  using (exists (
    select 1 from portal_users pu
    join onboarding_projects p on p.onboarding_company_id = pu.company_id
    where pu.user_id = auth.uid() and p.id = project_curriculum_items.project_id
  ));

drop policy if exists report_cards_staff on project_report_cards;
create policy report_cards_staff on project_report_cards for all
  using (exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active));
drop policy if exists report_cards_client on project_report_cards;
create policy report_cards_client on project_report_cards for select
  using (exists (
    select 1 from portal_users pu
    join onboarding_projects p on p.onboarding_company_id = pu.company_id
    where pu.user_id = auth.uid() and p.id = project_report_cards.project_id
  ));

grant select on curriculum_pillars, curriculum_items to authenticated;
grant select, insert, update, delete on curriculum_pillars, curriculum_items,
  project_curriculum_items, project_report_cards to authenticated;

-- ── Seed: 8 pilares da entrega UNV ────────────────────────────────────────
insert into curriculum_pillars (key, name, description, sort_order) values
  ('diagnostico', 'Diagnóstico & Estratégia', 'Leitura profunda do negócio, ICP, posicionamento e plano de 6 meses', 1),
  ('processo', 'Processo Comercial', 'Playbook, scripts, etapas do funil e cadências de follow-up', 2),
  ('crm', 'Funil & CRM', 'Pipeline estruturado, CRM implantado e higiene de dados', 3),
  ('time', 'Time Comercial', 'Estrutura do time, papéis, contratação e comissionamento', 4),
  ('metas', 'Metas & Indicadores', 'Metas desdobradas, KPIs lançados e acompanhados', 5),
  ('demanda', 'Geração de Demanda', 'Tráfego pago, prospecção ativa, parcerias e indicações', 6),
  ('gestao', 'Rotina de Gestão', 'Reuniões semanais, rituais de cobrança e disciplina de execução', 7),
  ('treinamento', 'Treinamento & Pessoas', 'Capacitação contínua, role plays e avaliação do time', 8)
on conflict (key) do nothing;

-- ── Seed: itens padrão da grade ───────────────────────────────────────────
with p as (select id, key from curriculum_pillars)
insert into curriculum_items (pillar_id, title, description, default_week, sort_order)
select p.id, i.title, i.description, i.week, i.ord
from p join (values
  -- diagnostico
  ('diagnostico', 'Diagnóstico comercial completo (Raio-X)', 'Funil atual, jornada, gargalos e concorrência', 1, 1),
  ('diagnostico', 'Definição de ICP e proposta de valor', 'Perfil de cliente ideal e posicionamento da oferta', 2, 2),
  ('diagnostico', 'Plano estratégico de 6 meses', 'Metas, marcos e primeira vitória rápida', 2, 3),
  ('diagnostico', 'Mapa de oferta e precificação', 'Portfólio, ticket médio alvo e ancoragem de preço', 3, 4),
  -- processo
  ('processo', 'Desenho do processo comercial (etapas do funil)', 'Da captação ao fechamento, com critérios de passagem', 3, 1),
  ('processo', 'Playbook de vendas', 'Scripts de abordagem, contorno de objeções e fechamento', 4, 2),
  ('processo', 'Cadência de follow-up', 'Régua de contatos por etapa (WhatsApp, ligação, e-mail)', 5, 3),
  ('processo', 'Processo de qualificação (BANT ou similar)', 'Critérios objetivos de lead qualificado', 5, 4),
  ('processo', 'Proposta comercial padronizada', 'Modelo de proposta com apresentação de valor', 6, 5),
  -- crm
  ('crm', 'Implantação do CRM', 'Funis, etapas e campos configurados', 4, 1),
  ('crm', 'Migração e higiene da base de leads', 'Base atual importada, duplicados tratados', 5, 2),
  ('crm', 'Rotina de uso do CRM pelo time', 'Time registrando 100% das oportunidades', 6, 3),
  ('crm', 'Automações do funil', 'Distribuição de leads, alertas e tarefas automáticas', 8, 4),
  -- time
  ('time', 'Desenho da estrutura do time', 'Papéis (SDR/Closer/Gestor) e responsabilidades', 3, 1),
  ('time', 'Plano de comissionamento', 'Comissões e aceleradores alinhados às metas', 5, 2),
  ('time', 'Recrutamento e seleção (se aplicável)', 'Vagas, perfil e processo seletivo', 8, 3),
  ('time', 'Onboarding de vendedores', 'Trilha de entrada pra novos vendedores', 10, 4),
  -- metas
  ('metas', 'Definição de metas e desdobramento', 'Meta da empresa desdobrada por vendedor', 2, 1),
  ('metas', 'KPIs implantados e lançamento diário', 'Indicadores definidos e rotina de lançamento', 4, 2),
  ('metas', 'Dashboard de indicadores', 'Visão gerencial de funil, conversão e receita', 6, 3),
  ('metas', 'Rotina de forecast', 'Previsão de fechamento mensal com o time', 10, 4),
  -- demanda
  ('demanda', 'Estratégia de geração de demanda', 'Mix de canais: tráfego, outbound, indicações, parcerias', 4, 1),
  ('demanda', 'Campanhas de tráfego pago no ar', 'Campanhas ativas com acompanhamento de CAC', 6, 2),
  ('demanda', 'Processo de prospecção ativa', 'Listas, cadência e metas de atividade outbound', 7, 3),
  ('demanda', 'Programa de indicações', 'Mecânica de indicação com clientes atuais', 12, 4),
  -- gestao
  ('gestao', 'Ritual semanal de gestão comercial', 'Reunião semanal com pauta, métricas e cobrança', 2, 1),
  ('gestao', 'Rotina diária do vendedor', 'Agenda padrão: prospecção, follow-up, CRM', 4, 2),
  ('gestao', 'Reunião mensal de resultados', 'Fechamento do mês com plano de ação', 6, 3),
  ('gestao', 'Gestão à vista', 'Placar de metas visível pro time', 8, 4),
  -- treinamento
  ('treinamento', 'Treinamento inicial do time', 'Imersão em processo, produto e playbook', 5, 1),
  ('treinamento', 'Role plays quinzenais', 'Simulações de venda com feedback', 7, 2),
  ('treinamento', 'Avaliação de performance individual', 'Avaliação por vendedor com plano de desenvolvimento', 12, 3),
  ('treinamento', 'Trilha contínua de capacitação', 'Calendário recorrente de treinamentos', 16, 4)
) as i(pillar_key, title, description, week, ord) on i.pillar_key = p.key
where not exists (select 1 from curriculum_items limit 1);

-- ── Cron: boletim semanal (segunda 10h UTC = 7h BRT) ──────────────────────
select cron.unschedule(jobid) from cron.job where jobname = 'curriculum-boletim-weekly';
select cron.schedule(
  'curriculum-boletim-weekly',
  '0 10 * * 1',
  $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/curriculum-engine',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk"}'::jsonb,
    body := '{"action":"batch"}'::jsonb
  ) as request_id;
  $$
);
