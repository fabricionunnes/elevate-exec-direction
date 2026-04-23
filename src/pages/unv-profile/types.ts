export type ProfileEmployeeStatus = "active" | "inactive" | "onboarding" | "terminated";

export interface ProfileEmployee {
  id: string;
  tenant_id: string | null;
  company_id: string | null;
  staff_id: string | null;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  position_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  employee_type: "internal" | "client";
  contract_type: string | null;
  status: ProfileEmployeeStatus;
  is_employee: boolean;
  hire_date: string | null;
  termination_date: string | null;
  salary: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileCompany {
  id: string;
  name: string;
  cnpj: string | null;
  industry: string | null;
  is_internal: boolean;
  logo_url: string | null;
  created_at: string;
}

export interface ProfileJob {
  id: string;
  title: string;
  area: string | null;
  seniority: string | null;
  contract_model: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  requirements: string | null;
  city: string | null;
  state: string | null;
  is_remote: boolean;
  status: "open" | "paused" | "closed" | "filled";
  public_token: string | null;
  opened_at: string;
  created_at: string;
}

export interface ProfileCandidate {
  id: string;
  job_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  stage: string;
  status: string;
  ai_score: number | null;
  ai_summary: string | null;
  is_favorite: boolean;
  tags: string[] | null;
  created_at: string;
}

export const PROFILE_PIPELINE_STAGES = [
  { key: "applied", label: "Inscrito", color: "bg-blue-500" },
  { key: "screening", label: "Triagem", color: "bg-indigo-500" },
  { key: "test", label: "Teste", color: "bg-violet-500" },
  { key: "hr_interview", label: "Entrevista RH", color: "bg-purple-500" },
  { key: "manager_interview", label: "Entrevista Gestor", color: "bg-fuchsia-500" },
  { key: "offer", label: "Proposta", color: "bg-pink-500" },
  { key: "hired", label: "Contratado", color: "bg-emerald-500" },
  { key: "rejected", label: "Reprovado", color: "bg-rose-500" },
  { key: "talent_pool", label: "Banco de Talentos", color: "bg-amber-500" },
] as const;

export const PROFILE_ROLES = [
  { key: "admin_master_unv", label: "Admin Master UNV" },
  { key: "admin_company", label: "Admin Empresa" },
  { key: "rh", label: "RH" },
  { key: "manager", label: "Gestor" },
  { key: "employee", label: "Colaborador" },
  { key: "recruiter", label: "Recrutador" },
  { key: "candidate", label: "Candidato" },
] as const;
