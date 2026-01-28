export interface CultureFormLink {
  id: string;
  project_id: string;
  access_token: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  expires_at: string | null;
}

export interface CultureFormResponse {
  id: string;
  project_id: string;
  form_link_id: string | null;
  respondent_name: string | null;
  respondent_role: string | null;
  respondent_email: string | null;
  
  // Identity & History
  company_history: string | null;
  founding_story: string | null;
  founders_motivation: string | null;
  
  // Purpose & Mission
  company_purpose: string | null;
  mission_statement: string | null;
  vision_statement: string | null;
  core_values: string | null;
  
  // Culture & Behavior
  cultural_principles: string | null;
  expected_behaviors: string | null;
  unacceptable_behaviors: string | null;
  
  // Leadership
  leadership_style: string | null;
  leadership_expectations: string | null;
  
  // Performance
  performance_culture: string | null;
  recognition_approach: string | null;
  meritocracy_principles: string | null;
  
  // Communication
  communication_style: string | null;
  internal_communication: string | null;
  
  // Clients
  client_relationship: string | null;
  client_experience_vision: string | null;
  
  // People
  ideal_team_member: string | null;
  who_should_not_join: string | null;
  growth_opportunities: string | null;
  
  // Future
  company_future_vision: string | null;
  legacy_aspiration: string | null;
  final_leadership_message: string | null;
  
  additional_notes: string | null;
  submitted_at: string;
  is_complete: boolean;
}

export interface CultureManualVersion {
  id: string;
  project_id: string;
  version_number: number;
  version_name: string | null;
  is_active: boolean;
  is_published: boolean;
  generated_by_ai: boolean;
  company_logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  created_at: string;
  created_by: string | null;
  published_at: string | null;
  published_by: string | null;
  notes: string | null;
}

export interface CultureManualSection {
  id: string;
  version_id: string;
  section_key: string;
  section_title: string;
  section_content: string | null;
  sort_order: number;
  is_locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  last_edited_at: string;
  last_edited_by: string | null;
}

export interface CultureAuditLog {
  id: string;
  project_id: string;
  version_id: string | null;
  action: string;
  action_details: Record<string, unknown> | null;
  performed_by_staff_id: string | null;
  performed_by_user_id: string | null;
  performed_at: string;
  ip_address: string | null;
}

export const MANUAL_SECTIONS = [
  { key: "cover", title: "Capa", order: 0 },
  { key: "presentation", title: "Apresentação Institucional", order: 1 },
  { key: "history", title: "História da Empresa", order: 2 },
  { key: "purpose", title: "Propósito e Razão de Existir", order: 3 },
  { key: "mission_vision_values", title: "Missão, Visão e Valores", order: 4 },
  { key: "cultural_principles", title: "Princípios Culturais", order: 5 },
  { key: "behavior_code", title: "Código de Comportamento", order: 6 },
  { key: "leadership_model", title: "Modelo de Liderança", order: 7 },
  { key: "performance_culture", title: "Cultura de Performance e Resultados", order: 8 },
  { key: "communication", title: "Comunicação Interna", order: 9 },
  { key: "client_relationship", title: "Relacionamento com Clientes", order: 10 },
  { key: "people_growth", title: "Pessoas, Crescimento e Reconhecimento", order: 11 },
  { key: "expectations", title: "O que Esperamos de Quem Faz Parte do Time", order: 12 },
  { key: "future", title: "O Futuro da Empresa", order: 13 },
  { key: "final_message", title: "Mensagem Final da Liderança", order: 14 },
] as const;
