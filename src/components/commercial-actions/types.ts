export interface CommercialActionTemplate {
  id: string;
  title: string;
  description: string | null;
  objective: string | null;
  niche: string | null;
  month: number | null;
  week: number | null;
  category: string;
  step_by_step: string | null;
  script: string | null;
  frequency: string | null;
  default_responsible: string | null;
  default_deadline_days: number | null;
  default_goal: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CommercialAction {
  id: string;
  project_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  objective: string | null;
  category: string;
  step_by_step: string | null;
  script: string | null;
  start_date: string | null;
  deadline: string | null;
  responsible_staff_id: string | null;
  priority: string;
  goal: string | null;
  result: string | null;
  status: string;
  recurrence: string | null;
  task_id: string | null;
  month: number | null;
  week: number | null;
  year: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  responsible_staff?: { id: string; name: string } | null;
}

export const ACTION_CATEGORIES = [
  "Prospecção",
  "Conteúdo",
  "Parcerias",
  "Eventos",
  "Reativação",
  "Follow-up",
  "Pós-venda",
  "Autoridade",
  "Networking",
] as const;

export const ACTION_STATUSES = [
  { value: "planned", label: "Planejada", color: "bg-blue-100 text-blue-800" },
  { value: "in_progress", label: "Em execução", color: "bg-yellow-100 text-yellow-800" },
  { value: "completed", label: "Concluída", color: "bg-green-100 text-green-800" },
  { value: "overdue", label: "Atrasada", color: "bg-red-100 text-red-800" },
] as const;

export const COMMERCIAL_NICHES = [
  "Agropecuária",
  "Corretora",
  "Saúde e Segurança do Trabalho",
  "Prestação de Serviços",
  "Clínica",
  "Indústria / Fábrica",
  "Consultoria / Mentoria",
  "Distribuidora",
  "Varejo",
  "Autoescola",
  "Turismo / Viagens",
  "Automóveis / Autopeças",
  "Atacado e Varejo",
  "Cursos / Treinamentos",
  "Imobiliária / Construção",
] as const;

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
] as const;
