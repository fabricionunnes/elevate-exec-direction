export interface CareerPlanForm {
  id: string;
  project_id: string;
  respondent_name: string | null;
  respondent_role: string | null;
  respondent_email: string | null;
  company_segment: string | null;
  employee_count: string | null;
  current_role_structure: string | null;
  company_culture_type: string | null;
  has_career_plan: boolean;
  current_career_plan_details: string | null;
  growth_preference: string | null;
  values_most: string | null;
  salary_ranges: string | null;
  raise_policy: string | null;
  benefits_by_level: string | null;
  current_evaluation_criteria: string | null;
  evaluation_frequency: string | null;
  uses_goals: boolean;
  goal_types: string[] | null;
  additional_notes: string | null;
  is_complete: boolean;
  submitted_at: string;
  created_at: string;
}

export interface CareerPlanVersion {
  id: string;
  project_id: string;
  version_number: number;
  version_name: string | null;
  is_active: boolean;
  is_published: boolean;
  generated_by_ai: boolean;
  created_at: string;
  created_by: string | null;
  published_at: string | null;
  published_by: string | null;
  notes: string | null;
}

export interface CareerTrack {
  id: string;
  version_id: string;
  name: string;
  description: string | null;
  track_type: string;
  department: string | null;
  sort_order: number;
  created_at: string;
  roles?: CareerRole[];
}

export interface CareerRole {
  id: string;
  track_id: string;
  name: string;
  description: string | null;
  level_order: number;
  salary_base: number | null;
  salary_min: number | null;
  salary_max: number | null;
  benefits: string | null;
  min_time_months: number | null;
  max_time_months: number | null;
  is_entry_level: boolean;
  created_at: string;
  updated_at: string;
  criteria?: CareerCriterion[];
  goals?: CareerGoal[];
}

export interface CareerCriterion {
  id: string;
  role_id: string;
  name: string;
  description: string | null;
  weight: number;
  min_score: number;
  criteria_type: string;
  sort_order: number;
  created_at: string;
}

export interface CareerGoal {
  id: string;
  role_id: string;
  title: string;
  description: string | null;
  goal_type: string;
  target_value: string | null;
  measurement_unit: string | null;
  sort_order: number;
  created_at: string;
}

export interface CareerEvaluation {
  id: string;
  project_id: string;
  version_id: string | null;
  employee_name: string;
  employee_email: string | null;
  current_role_id: string | null;
  evaluation_date: string;
  overall_score: number | null;
  status: string;
  time_in_role_months: number | null;
  criteria_scores: any;
  goals_achieved: any;
  evaluator_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const GROWTH_PREFERENCES = [
  { value: 'vertical', label: 'Vertical (hierárquico)' },
  { value: 'horizontal', label: 'Horizontal (especialização)' },
  { value: 'both', label: 'Ambos (vertical e horizontal)' },
];

export const VALUES_MOST = [
  { value: 'leadership', label: 'Liderança' },
  { value: 'technical', label: 'Especialização Técnica' },
  { value: 'commercial', label: 'Resultados Comerciais' },
];

export const RAISE_POLICIES = [
  { value: 'time', label: 'Por tempo de casa' },
  { value: 'merit', label: 'Por mérito' },
  { value: 'result', label: 'Por resultado' },
  { value: 'mixed', label: 'Misto' },
];

export const EVALUATION_FREQUENCIES = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
];

export const GOAL_TYPE_OPTIONS = [
  { value: 'sales', label: 'Vendas' },
  { value: 'projects', label: 'Projetos' },
  { value: 'behavior', label: 'Comportamento' },
  { value: 'learning', label: 'Aprendizado' },
];

export const CRITERIA_TYPES = [
  { value: 'performance', label: 'Performance' },
  { value: 'behavior', label: 'Comportamento' },
  { value: 'goals', label: 'Entrega de Metas' },
  { value: 'evaluation', label: 'Avaliações' },
  { value: 'learning', label: 'Aprendizado' },
];

export const EVALUATION_STATUSES: Record<string, { label: string; color: string }> = {
  eligible: { label: 'Apto para Promoção', color: '#22c55e' },
  developing: { label: 'Em Desenvolvimento', color: '#f59e0b' },
  not_eligible: { label: 'Não Elegível', color: '#ef4444' },
  in_progress: { label: 'Em Andamento', color: '#6366f1' },
  completed: { label: 'Concluída', color: '#3b82f6' },
};
