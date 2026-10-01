// Atividade do CRM <-> Google Agenda de quem está logado.
// Usa a mesma edge function das reuniões (google-calendar). O evento fica ligado à
// atividade por crm_activities.google_calendar_event_id / google_calendar_user_id.
import { supabase } from "@/integrations/supabase/client";

/** Onde a pessoa conecta o Google (CRM > Escritório). */
export const GOOGLE_CONNECT_PATH = "/crm/office";

export const ACTIVITY_EVENT_MINUTES = 30;

export interface GoogleResult<T = any> {
  ok: boolean;
  data?: T;
  /** Google não conectado ou token vencido: a pessoa precisa (re)conectar */
  needsAuth?: boolean;
  error?: string;
}

async function invokeGoogle<T = any>(action: string, body: Record<string, unknown> = {}): Promise<GoogleResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(`google-calendar?action=${action}`, { body });
    if (error) {
      // resposta fora do 2xx: o motivo vem no corpo (error.context é o Response)
      let parsed: any = null;
      try { parsed = await (error as any).context?.json?.(); } catch { /* corpo não é JSON */ }
      return { ok: false, needsAuth: !!parsed?.needsAuth, error: parsed?.error || error.message };
    }
    if (data?.needsAuth) return { ok: false, needsAuth: true, error: data?.error };
    if (data?.error) return { ok: false, error: data.error };
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao falar com o Google Agenda" };
  }
}

let connectedCache: { at: number; value: boolean } | null = null;

/** A pessoa logada tem o Google conectado? (guarda a resposta por 1 minuto) */
export async function isGoogleConnected(force = false): Promise<boolean> {
  if (!force && connectedCache && Date.now() - connectedCache.at < 60000) return connectedCache.value;
  const res = await invokeGoogle<{ connected: boolean }>("check-connection");
  const value = !!(res.ok && res.data?.connected);
  connectedCache = { at: Date.now(), value };
  return value;
}

/** "2026-10-02T14:30" (horário de Brasília) + minutos -> "2026-10-02T15:00:00" */
function addMinutesLocal(local: string, minutes: number): string {
  const [d, t] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day, hh, mm + minutes));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}T${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())}:00`;
}

/** ISO (timestamptz) -> "yyyy-MM-ddTHH:mm" no fuso de Brasília, que é o que os inputs e o Google usam aqui. */
export function isoToBrasiliaLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

interface EventInput {
  title: string;
  description?: string | null;
  /** "yyyy-MM-ddTHH:mm" em horário de Brasília */
  startLocal: string;
  minutes?: number;
}

/** Cria o evento na agenda de quem está logado. */
export async function createActivityEvent(input: EventInput): Promise<GoogleResult<{ eventId: string; userId: string | null; meetingLink: string | null }>> {
  const res = await invokeGoogle("create-event", {
    title: input.title,
    description: input.description || "",
    startDateTime: `${input.startLocal}:00`,
    endDateTime: addMinutesLocal(input.startLocal, input.minutes || ACTIVITY_EVENT_MINUTES),
  });
  if (!res.ok || !res.data?.event?.id) return { ok: false, needsAuth: res.needsAuth, error: res.error || "O Google não devolveu o evento" };
  const { data: auth } = await supabase.auth.getUser();
  return { ok: true, data: { eventId: res.data.event.id, userId: auth.user?.id || null, meetingLink: res.data.event.meetingLink || null } };
}

/** Só muda dia e hora do evento (mantém Meet, convidados e duração). */
export function moveActivityEvent(eventId: string, startIso: string, targetUserId?: string | null): Promise<GoogleResult> {
  return invokeGoogle("move-event", { eventId, startDateTime: startIso, target_user_id: targetUserId || undefined });
}

/** Regrava título, descrição e horário. NÃO usar em reunião com Meet e convidados: o PUT apaga os dois. */
export function updateActivityEvent(eventId: string, input: EventInput, targetUserId?: string | null): Promise<GoogleResult> {
  return invokeGoogle("update-event", {
    eventId,
    title: input.title,
    description: input.description || "",
    startDateTime: `${input.startLocal}:00`,
    endDateTime: addMinutesLocal(input.startLocal, input.minutes || ACTIVITY_EVENT_MINUTES),
    target_user_id: targetUserId || undefined,
  });
}

export function deleteActivityEvent(eventId: string, targetUserId?: string | null): Promise<GoogleResult> {
  return invokeGoogle("delete-event", { eventId, target_user_id: targetUserId || undefined });
}
