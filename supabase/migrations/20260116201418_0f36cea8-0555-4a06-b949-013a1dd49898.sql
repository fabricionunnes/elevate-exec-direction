-- Índices para otimizar queries de tarefas (impacto alto no dashboard)
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON onboarding_tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_pending ON onboarding_tasks(due_date) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_tasks_responsible ON onboarding_tasks(responsible_staff_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON onboarding_tasks(completed_at DESC) WHERE status = 'completed';

-- Índices para KPIs
CREATE INDEX IF NOT EXISTS idx_kpi_entries_date ON kpi_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_entries_company ON kpi_entries(company_id, entry_date DESC);

-- Índices para NPS
CREATE INDEX IF NOT EXISTS idx_nps_responses_project ON onboarding_nps_responses(project_id, created_at DESC);

-- Índices para health scores
CREATE INDEX IF NOT EXISTS idx_health_scores_project ON client_health_scores(project_id);

-- Índices para projetos
CREATE INDEX IF NOT EXISTS idx_projects_status ON onboarding_projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_company ON onboarding_projects(onboarding_company_id, status);

-- Índices para empresas
CREATE INDEX IF NOT EXISTS idx_companies_status ON onboarding_companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_consultant ON onboarding_companies(consultant_id) WHERE status = 'active';