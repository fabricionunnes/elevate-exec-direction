// Tipos e helpers do UNV IA Academy (tabelas ia_academy_* e colunas novas do
// Academy). As tabelas ainda não estão nos tipos gerados do Supabase, por
// isso o acesso passa por `iaDb` (client sem tipagem de schema).
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const iaDb = supabase as any;

export type IaPlan = "monthly" | "annual";

export interface IaSubscription {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  cpf: string | null;
  company_name: string | null;
  segment: string | null;
  plan: IaPlan;
  amount_cents: number;
  payment_method: string;
  status: "pending" | "active" | "past_due" | "cancelled" | "refunded";
  asaas_subscription_id: string | null;
  asaas_invoice_url: string | null;
  current_period_end: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  user_id: string | null;
  onboarding_user_id: string | null;
  onboarding_project_id: string | null;
  onboarding_call_status: "pending" | "requested" | "scheduled" | "done" | "skipped";
  onboarding_call_requested_at: string | null;
  onboarding_call_preferences: string | null;
  onboarding_call_at: string | null;
  onboarding_call_meeting_url: string | null;
  onboarding_call_notes: string | null;
  onboarding_call_plan_md: string | null;
  created_at: string;
}

export interface IaLiveSession {
  id: string;
  kind: "hotseat" | "implementation" | "masterclass";
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  host_name: string;
  max_participants: number | null;
  status: "scheduled" | "live" | "done" | "cancelled";
  recording_url: string | null;
  recording_lesson_id: string | null;
  track_id: string | null;
}

export interface IaLiveRegistration {
  id: string;
  session_id: string;
  onboarding_user_id: string;
  question: string | null;
  topic: string | null;
  wants_hotseat: boolean;
  picked_for_hotseat: boolean;
  status: "registered" | "attended" | "missed" | "cancelled";
  created_at: string;
}

export interface IaLabItem {
  id: string;
  title: string;
  slug: string;
  category: "prompt" | "agent" | "n8n_flow" | "template" | "checklist";
  crescer_phase: string | null;
  description: string | null;
  prompt_text: string | null;
  external_url: string | null;
  tools: string[];
  track_id: string | null;
  lesson_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface LessonDeliverable {
  id: string;
  lesson_id: string;
  onboarding_user_id: string;
  proof_url: string | null;
  notes: string | null;
  status: "submitted" | "approved" | "changes_requested";
  feedback: string | null;
  reviewed_at: string | null;
  points_awarded: number;
  created_at: string;
  updated_at: string;
}

export const PLAN_LABEL: Record<IaPlan, string> = { monthly: "Mensal · R$ 297", annual: "Anual · R$ 2.497" };

export const SUB_STATUS_LABEL: Record<IaSubscription["status"], string> = {
  pending: "Aguardando pagamento",
  active: "Ativa",
  past_due: "Em atraso",
  cancelled: "Cancelada",
  refunded: "Estornada",
};

export const CALL_STATUS_LABEL: Record<IaSubscription["onboarding_call_status"], string> = {
  pending: "Não solicitada",
  requested: "Solicitada",
  scheduled: "Agendada",
  done: "Realizada",
  skipped: "Dispensada",
};

export const LIVE_KIND_LABEL: Record<IaLiveSession["kind"], string> = {
  hotseat: "Hotseat mensal",
  implementation: "Implementação ao vivo",
  masterclass: "Masterclass",
};

export const LAB_CATEGORY_LABEL: Record<IaLabItem["category"], string> = {
  prompt: "Prompt",
  agent: "Agente",
  n8n_flow: "Fluxo N8N",
  template: "Template",
  checklist: "Checklist",
};

export const CRESCER_PHASE_LABEL: Record<string, string> = {
  cenario: "Cenário",
  resultado_ideal: "Resultado ideal",
  estrutura: "Estrutura",
  captacao: "Captação",
  conversao: "Conversão",
  escala: "Escala",
  revisao: "Revisão",
};

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

/** Assinatura ativa do aluno (ou null): usada pra mostrar a sessão 1:1 e o plano. */
export async function loadMySubscription(onboardingUserId: string | null): Promise<IaSubscription | null> {
  if (!onboardingUserId) return null;
  const { data } = await iaDb
    .from("ia_academy_subscriptions")
    .select("*")
    .eq("onboarding_user_id", onboardingUserId)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as IaSubscription) || null;
}
