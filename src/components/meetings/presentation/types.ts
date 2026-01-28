export type PresentationStatus = 'draft' | 'approved' | 'archived';
export type MeetingObjective = 'diagnostico' | 'alinhamento' | 'planejamento' | 'resultados' | 'decisao';
export type MeetingAudience = 'empresario' | 'diretoria' | 'gestores' | 'time_operacional';
export type MeetingDepthLevel = 'estrategico' | 'tatico' | 'operacional';
export type PresentationTone = 'institucional' | 'consultivo' | 'provocativo' | 'inspirador';

export interface PresentationBriefing {
  subject: string;
  central_theme: string;
  objective: MeetingObjective;
  audience: MeetingAudience;
  depth_level: MeetingDepthLevel;
  estimated_duration_minutes: number;
  key_metrics?: string;
  must_include_points?: string;
  tone: PresentationTone;
}

export interface MeetingPresentation {
  id: string;
  meeting_id: string;
  project_id: string;
  subject: string;
  central_theme: string;
  objective: MeetingObjective;
  audience: MeetingAudience;
  depth_level: MeetingDepthLevel;
  estimated_duration_minutes: number;
  key_metrics?: string;
  must_include_points?: string;
  tone: PresentationTone;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PresentationVersion {
  id: string;
  presentation_id: string;
  version_number: number;
  status: PresentationStatus;
  title?: string;
  company_name?: string;
  meeting_date?: string;
  pdf_url?: string;
  generated_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export interface SlideContent {
  bullets?: string[];
  text?: string;
  question?: string;
  options?: string[];
  highlight?: string;
  metric_value?: string;
  metric_label?: string;
}

export interface PresentationSlide {
  id: string;
  version_id: string;
  slide_number: number;
  slide_type: string;
  title?: string;
  subtitle?: string;
  content: SlideContent;
  has_chart: boolean;
  has_image: boolean;
  image_prompt?: string;
  is_interactive: boolean;
  interactive_type?: string;
  sort_order: number;
  created_at: string;
}

export interface PresentationLog {
  id: string;
  presentation_id: string;
  version_id?: string;
  action: string;
  details: Record<string, unknown>;
  performed_by?: string;
  performed_at: string;
}

export const OBJECTIVE_LABELS: Record<MeetingObjective, string> = {
  diagnostico: 'Diagnóstico',
  alinhamento: 'Alinhamento',
  planejamento: 'Planejamento',
  resultados: 'Apresentação de Resultados',
  decisao: 'Tomada de Decisão',
};

export const AUDIENCE_LABELS: Record<MeetingAudience, string> = {
  empresario: 'Empresário/Sócio',
  diretoria: 'Diretoria',
  gestores: 'Gestores',
  time_operacional: 'Time Operacional',
};

export const DEPTH_LABELS: Record<MeetingDepthLevel, string> = {
  estrategico: 'Estratégico',
  tatico: 'Tático',
  operacional: 'Operacional',
};

export const TONE_LABELS: Record<PresentationTone, string> = {
  institucional: 'Institucional',
  consultivo: 'Consultivo',
  provocativo: 'Provocativo',
  inspirador: 'Inspirador',
};
