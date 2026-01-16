export interface JobOpening {
  id: string;
  project_id: string;
  company_id: string | null;
  title: string;
  area: string;
  job_type: string;
  description: string | null;
  requirements: string | null;
  differentials: string | null;
  seniority: string | null;
  contract_model: string | null;
  status: string;
  salary_range: string | null;
  location: string | null;
  is_remote: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  candidates_count?: number;
  target_date: string | null;
  sla_days: number | null;
  responsible_rh_id: string | null;
  consultant_id: string | null;
  internal_notes: string | null;
}

export interface Candidate {
  id: string;
  project_id: string;
  job_opening_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  linkedin_url: string | null;
  source: string;
  current_stage: string;
  status: string;
  notes: string | null;
  created_by_staff_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  job_opening?: JobOpening | { id: string; title: string };
  resumes?: CandidateResume[];
  disc_results?: DISCResult[];
  ai_evaluations?: AIEvaluation[];
}

export interface CandidateResume {
  id: string;
  candidate_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  is_primary: boolean;
  uploaded_by_staff_id: string | null;
  uploaded_by_user_id: string | null;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  project_id: string;
  name: string;
  stage_key: string;
  sort_order: number;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  job_opening_id: string | null;
  interview_type: string;
  scheduled_at: string | null;
  conducted_at: string | null;
  interviewer_id: string | null;
  interviewer_name: string | null;
  status: string;
  score: number | null;
  strengths: string | null;
  concerns: string | null;
  detailed_feedback: string | null;
  recommendation: string | null;
  created_at: string;
  updated_at: string;
  interviewer?: { name: string };
}

export interface DISCResult {
  id: string;
  candidate_id: string;
  access_token: string;
  status: string;
  dominant_profile: string | null;
  d_score: number | null;
  i_score: number | null;
  s_score: number | null;
  c_score: number | null;
  interpretation: string | null;
  raw_responses: any;
  completed_at: string | null;
  sent_at: string | null;
  sent_by: string | null;
  created_at: string;
}

export interface AIEvaluation {
  id: string;
  candidate_id: string;
  resume_id: string | null;
  job_opening_id: string | null;
  compatibility_score: number | null;
  classification: string | null;
  strengths: string[] | null;
  concerns: string[] | null;
  recommendation: string | null;
  full_analysis: string | null;
  model_used: string | null;
  created_at: string;
}

export interface HiringHistory {
  id: string;
  candidate_id: string;
  action: string;
  previous_value: string | null;
  new_value: string | null;
  description: string | null;
  performed_by_staff_id: string | null;
  performed_by_user_id: string | null;
  metadata: any;
  created_at: string;
  staff?: { name: string };
  user?: { name: string };
}

export const PIPELINE_STAGES = [
  { key: 'received', name: 'Currículo Recebido', color: '#6366f1' },
  { key: 'screening', name: 'Triagem', color: '#8b5cf6' },
  { key: 'disc', name: 'DISC', color: '#a855f7' },
  { key: 'hr_interview', name: 'Entrevista RH', color: '#d946ef' },
  { key: 'technical_interview', name: 'Entrevista Técnica', color: '#ec4899' },
  { key: 'final_interview', name: 'Entrevista Final', color: '#f43f5e' },
  { key: 'approved', name: 'Aprovado', color: '#22c55e' },
  { key: 'rejected', name: 'Reprovado', color: '#ef4444' },
  { key: 'talent_pool', name: 'Banco de Talentos', color: '#f59e0b' },
];

export const JOB_AREAS = [
  'Comercial',
  'CS (Customer Success)',
  'Marketing',
  'Operações',
  'Administrativo',
  'Financeiro',
  'TI',
  'RH',
  'Outro',
];

export const JOB_TYPES = [
  'SDR',
  'Closer',
  'Consultor',
  'CS',
  'Gestor',
  'Analista',
  'Assistente',
  'Outro',
];

export const SENIORITY_LEVELS = [
  'Estágio',
  'Júnior',
  'Pleno',
  'Sênior',
  'Especialista',
  'Gerente',
  'Diretor',
];

export const CONTRACT_MODELS = [
  'CLT',
  'PJ',
  'Comissão',
  'Híbrido (CLT + Comissão)',
  'Freelancer',
];

export const SOURCE_LABELS: Record<string, string> = {
  client: 'Enviado pelo Cliente',
  hr: 'Enviado pelo RH',
  public_link: 'Link Público',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  hired: 'Contratado',
  rejected: 'Reprovado',
  withdrawn: 'Desistiu',
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  paused: 'Pausada',
  closed: 'Encerrada',
};
