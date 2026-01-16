-- Função para obter métricas agregadas de tarefas por projeto
-- Isso evita buscar todas as 11k+ tarefas do banco
CREATE OR REPLACE FUNCTION get_task_metrics_by_project()
RETURNS TABLE(
  project_id uuid,
  total_tasks bigint,
  completed_tasks bigint,
  pending_tasks bigint,
  in_progress_tasks bigint,
  overdue_tasks bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.project_id,
    COUNT(*)::bigint as total_tasks,
    COUNT(*) FILTER (WHERE t.status = 'completed')::bigint as completed_tasks,
    COUNT(*) FILTER (WHERE t.status = 'pending')::bigint as pending_tasks,
    COUNT(*) FILTER (WHERE t.status = 'in_progress')::bigint as in_progress_tasks,
    COUNT(*) FILTER (WHERE t.status != 'completed' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE)::bigint as overdue_tasks
  FROM onboarding_tasks t
  GROUP BY t.project_id;
$$;

-- Função para obter tarefas pendentes/atrasadas (as que realmente precisamos mostrar)
-- Limita a busca apenas às tarefas relevantes para o dashboard
CREATE OR REPLACE FUNCTION get_pending_and_overdue_tasks()
RETURNS TABLE(
  id uuid,
  title text,
  status text,
  due_date date,
  project_id uuid,
  responsible_staff_id uuid,
  completed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.title,
    t.status,
    t.due_date,
    t.project_id,
    t.responsible_staff_id,
    t.completed_at
  FROM onboarding_tasks t
  WHERE t.status IN ('pending', 'in_progress')
     OR (t.status = 'completed' AND t.completed_at >= CURRENT_DATE - INTERVAL '90 days');
$$;