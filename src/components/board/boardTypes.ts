// Tipos das tabelas do UNV Board.
// As tabelas unv_board_* ainda não estão no types.ts gerado do Supabase —
// todo acesso usa (supabase as any).from("...") e estes tipos locais.

export interface BoardRoom {
  id: string;
  name: string;
  weekday: number; // 0=domingo ... 6=sábado
  time_slot: string; // "19:00:00"
  week_parity: "A" | "B";
  capacity: number;
  is_active: boolean;
}

export type BoardMemberStatus = "active" | "paused" | "churned" | "completed";
export type BoardPlanStatus = "pending" | "generating" | "review" | "published";

export interface BoardMember {
  id: string;
  company_id: string;
  project_id: string | null;
  room_id: string | null;
  entry_date: string;
  status: BoardMemberStatus;
  plan_status: BoardPlanStatus;
  segment_snapshot: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  notes: string | null;
  company_name?: string;
}

export type BoardPlanActionStatus = "draft" | "approved" | "published" | "discarded";

export interface BoardPlanAction {
  id: string;
  member_id: string;
  phase: number;
  phase_name: string;
  due_date: string;
  title: string;
  description: string | null;
  deliverable_type: string | null;
  status: BoardPlanActionStatus;
  task_id: string | null;
  origin: string | null;
}

export interface BoardDeliverable {
  id: string;
  member_id: string;
  company_id: string;
  type: string;
  title: string;
  version: number;
  form_data: Record<string, unknown> | null;
  content_md: string | null;
  pdf_path: string | null;
  status: "draft" | "final";
  created_at: string;
  company_name?: string;
}

export type BoardSessionStatus = "scheduled" | "done" | "no_show" | "cancelled";

export interface BoardSession {
  id: string;
  member_id: string;
  consultant_staff_id: string | null;
  scheduled_at: string;
  duration_min: number;
  status: BoardSessionStatus;
  meeting_link: string | null;
  agenda: string | null;
  notes: string | null;
  company_name?: string;
  consultant_name?: string;
}

export interface BoardNps {
  id: string;
  member_id: string;
  company_id: string;
  cycle_days: number;
  due_date: string | null;
  sent_at: string | null;
  answered_at: string | null;
  score: number | null;
  feedback: string | null;
  status: "pending" | "sent" | "answered" | "skipped";
  company_name?: string;
}

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const formatTimeSlot = (t: string | null | undefined) => (t ? t.slice(0, 5) : "—");

/** Busca nomes das empresas em lote e devolve um map id → name. */
export async function fetchCompanyNameMap(
  supabaseClient: unknown,
  companyIds: string[],
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(companyIds.filter(Boolean)));
  if (!ids.length) return {};
  const { data, error } = await (supabaseClient as any)
    .from("onboarding_companies")
    .select("id, name")
    .in("id", ids);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const c of data as { id: string; name: string }[]) map[c.id] = c.name;
  return map;
}
