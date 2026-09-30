// Preferências de notificação do Atendimento (crm_service_notifications).
// Lidas pelos emissores do front: o sino do CRM (CRMNotificationsBell) e o
// avisador de mensagem recebida (CRMInboundMessageNotifier). A tela que salva
// (NotificationsSection) dispara PREFS_EVENT pra todo mundo recarregar.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CrmNotificationPrefs {
  notify_new_message: boolean;
  notify_new_lead: boolean;
  notify_assignment: boolean;
  notify_sound: boolean;
  /** "HH:MM" ou null (sem limite) */
  notify_from: string | null;
  notify_until: string | null;
  /** mensagens: uma notificação por conversa a cada X minutos */
  group_minutes: number;
}

export const DEFAULT_PREFS: CrmNotificationPrefs = {
  notify_new_message: true,
  notify_new_lead: true,
  notify_assignment: true,
  notify_sound: true,
  notify_from: null,
  notify_until: null,
  group_minutes: 5,
};

export const PREFS_EVENT = "crm-notification-prefs-changed";

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : null);

export const normalizePrefs = (row: any): CrmNotificationPrefs => ({
  notify_new_message: row?.notify_new_message ?? DEFAULT_PREFS.notify_new_message,
  notify_new_lead: row?.notify_new_lead ?? DEFAULT_PREFS.notify_new_lead,
  notify_assignment: row?.notify_assignment ?? DEFAULT_PREFS.notify_assignment,
  notify_sound: row?.notify_sound ?? DEFAULT_PREFS.notify_sound,
  notify_from: hhmm(row?.notify_from),
  notify_until: hhmm(row?.notify_until),
  group_minutes: Number(row?.group_minutes) > 0 ? Number(row.group_minutes) : DEFAULT_PREFS.group_minutes,
});

/** Janela de horário: true quando agora (hora local) está dentro do intervalo. Sem intervalo = sempre. */
export const isWithinNotifyWindow = (prefs: CrmNotificationPrefs, now = new Date()): boolean => {
  if (!prefs.notify_from || !prefs.notify_until) return true;
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const from = toMin(prefs.notify_from);
  const until = toMin(prefs.notify_until);
  if (from === until) return true;
  // intervalo normal (08:00 às 18:00) ou cruzando a meia-noite (20:00 às 06:00)
  return from < until ? cur >= from && cur < until : cur >= from || cur < until;
};

/** Que preferência governa cada tipo de onboarding_notifications. null = não tem toggle (sempre avisa). */
export const prefKeyForNotificationType = (type: string): keyof CrmNotificationPrefs | null => {
  if (type === "new_lead") return "notify_new_lead";
  if (type === "task_assigned" || type === "meeting_scheduled" || type === "crm_stage_activity") return "notify_assignment";
  return null;
};

export const useCrmNotificationPrefs = (staffId: string | null) => {
  const [prefs, setPrefs] = useState<CrmNotificationPrefs>(DEFAULT_PREFS);

  const load = useCallback(async () => {
    if (!staffId) return;
    const { data } = await supabase
      .from("crm_service_notifications")
      .select("*")
      .eq("staff_id", staffId)
      .maybeSingle();
    setPrefs(normalizePrefs(data));
  }, [staffId]);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(PREFS_EVENT, onChange);
    return () => window.removeEventListener(PREFS_EVENT, onChange);
  }, [load]);

  return prefs;
};
