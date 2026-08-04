// agenda-watch: vigia a agenda do Google do Fabrício e avisa no WhatsApp.
// Modos:
//   {mode:"tick"}   (cron */5) — detecta reunião criada/editada/cancelada e
//                                dispara os lembretes de 30 e 5 minutos
//   {mode:"daily"}  (cron 8h)  — resumo das reuniões do dia
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fabrício: staff, usuário da agenda e WhatsApp de destino
const STAFF_ID = "b1a918b1-8776-4962-898e-5d97c7cc80c1";
const CALENDAR_USER_ID = "98f3de7f-6d6f-4f3c-b2da-b9e479ce96e3";
const NOTIFY_PHONE = "5531989840003";
const APP = "https://unvholdings.com.br";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** WhatsApp pela instância oficial "fabricionunnes" */
async function sendWhatsApp(supabase: any, text: string): Promise<boolean> {
  try {
    let { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, api_url, api_key, status, provider_type")
      .eq("instance_name", "fabricionunnes")
      .eq("status", "connected")
      .maybeSingle();
    if (!inst) {
      const { data: fb } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, api_url, api_key, status, provider_type")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      inst = fb;
    }
    if (!inst?.api_url || !inst?.api_key) return false;
    let host = "";
    try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* noop */ }
    const isManagerV2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
    const url = isManagerV2
      ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text`
      : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: inst.api_key },
      body: JSON.stringify({ number: NOTIFY_PHONE, text }),
    });
    return resp.ok;
  } catch (e) {
    console.error("[agenda-watch] whatsapp:", e);
    return false;
  }
}

const BR = "America/Sao_Paulo";
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: BR, hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: BR, day: "2-digit", month: "2-digit", year: "numeric" });
const fmtWeekday = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: BR, weekday: "long" });

/** Descobre o lead ou o projeto ligado ao evento, pra mandar o link certo */
async function findContext(supabase: any, eventId: string, description: string | null) {
  // 1) atividade do CRM criada junto do evento
  const { data: act } = await supabase
    .from("crm_activities")
    .select("lead_id")
    .eq("google_calendar_event_id", eventId)
    .not("lead_id", "is", null)
    .maybeSingle();

  if (act?.lead_id) {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id, name, company")
      .eq("id", act.lead_id)
      .maybeSingle();
    if (lead) {
      return {
        label: `Lead: ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
        link: `${APP}/#/crm/leads/${lead.id}`,
      };
    }
  }

  // 2) link do Nexus escrito na descrição do evento
  const desc = description || "";
  const leadMatch = desc.match(/crm\/leads\/([0-9a-f-]{36})/i);
  if (leadMatch) {
    const { data: lead } = await supabase
      .from("crm_leads").select("id, name, company").eq("id", leadMatch[1]).maybeSingle();
    if (lead) {
      return {
        label: `Lead: ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
        link: `${APP}/#/crm/leads/${lead.id}`,
      };
    }
  }
  const projMatch = desc.match(/onboarding-tasks\/([0-9a-f-]{36})/i);
  if (projMatch) {
    const { data: proj } = await supabase
      .from("onboarding_projects")
      .select("id, product_name, onboarding_company_id, company:onboarding_companies!onboarding_projects_onboarding_company_id_fkey(name)")
      .eq("id", projMatch[1])
      .maybeSingle();
    if (proj) {
      const nome = (proj as any).company?.name || proj.product_name || "Projeto";
      return { label: `Empresa: ${nome}`, link: `${APP}/#/onboarding-tasks/${proj.id}` };
    }
  }
  return null;
}

async function listEvents(): Promise<any[]> {
  const resp = await fetch(
    `${SUPABASE_URL}/functions/v1/google-calendar?action=events&target_user_id=${CALENDAR_USER_ID}`,
    { headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" } }
  );
  if (!resp.ok) {
    console.error("[agenda-watch] calendar list falhou:", resp.status, await resp.text());
    return [];
  }
  const data = await resp.json();
  return data.events || [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode || "tick";

  try {
    const events = await listEvents();
    const now = Date.now();

    // ── resumo do dia ────────────────────────────────────────────────────────
    if (mode === "daily") {
      const hojeBR = new Date().toLocaleDateString("en-CA", { timeZone: BR }); // YYYY-MM-DD
      const doDia = events
        .filter((e: any) => e.start && new Date(e.start).toLocaleDateString("en-CA", { timeZone: BR }) === hojeBR)
        .sort((a: any, b: any) => String(a.start).localeCompare(String(b.start)));

      if (doDia.length === 0) {
        await sendWhatsApp(supabase, `*Agenda de hoje* — ${fmtWeekday(new Date().toISOString())}\n\nNenhuma reunião marcada.`);
        return json({ ok: true, mode, count: 0 });
      }

      const linhas: string[] = [];
      for (const e of doDia) {
        const ctx = await findContext(supabase, e.id, e.description);
        linhas.push(
          [
            `*${fmtTime(e.start)}* — ${e.title}`,
            ctx ? `${ctx.label}\n${ctx.link}` : null,
            e.meetingLink ? e.meetingLink : null,
          ].filter(Boolean).join("\n")
        );
      }

      const texto = [
        `*Agenda de hoje* — ${fmtWeekday(doDia[0].start)}, ${fmtDate(doDia[0].start)}`,
        `${doDia.length} reunião${doDia.length === 1 ? "" : "es"}`,
        "",
        linhas.join("\n\n"),
      ].join("\n");

      await sendWhatsApp(supabase, texto);
      return json({ ok: true, mode, count: doDia.length });
    }

    // ── tick: novidades na agenda + lembretes ────────────────────────────────
    const { data: snapshot } = await supabase
      .from("agenda_watch_events")
      .select("*")
      .eq("user_id", CALENDAR_USER_ID);
    const known = new Map<string, any>((snapshot || []).map((r: any) => [r.google_event_id, r]));

    const seen = new Set<string>();
    const notifications: string[] = [];
    let created = 0, updated = 0, cancelled = 0, reminders = 0;

    for (const e of events) {
      if (!e.start) continue;
      seen.add(e.id);
      const fingerprint = `${e.title}|${e.start}|${e.end}`;
      const prev = known.get(e.id);
      const startMs = new Date(e.start).getTime();

      const row = {
        google_event_id: e.id,
        user_id: CALENDAR_USER_ID,
        title: e.title,
        start_at: e.start,
        end_at: e.end,
        meeting_link: e.meetingLink,
        calendar_link: e.calendarLink,
        fingerprint,
        cancelled: false,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!prev) {
        // Primeira execução: só fotografa o que já existe, sem disparar tudo de uma vez
        const isBootstrap = (snapshot || []).length === 0;
        await supabase.from("agenda_watch_events").upsert({
          ...row,
          notified_created: true,
          notified_30: startMs - now < 30 * 60000,
          notified_5: startMs - now < 5 * 60000,
        });
        if (!isBootstrap && startMs > now) {
          const ctx = await findContext(supabase, e.id, e.description);
          notifications.push([
            "*Nova reunião na agenda*",
            "",
            `*${e.title}*`,
            `${fmtWeekday(e.start)}, ${fmtDate(e.start)} às ${fmtTime(e.start)}`,
            ctx ? `\n${ctx.label}\n${ctx.link}` : null,
            e.meetingLink ? `\nLink: ${e.meetingLink}` : null,
          ].filter(Boolean).join("\n"));
          created++;
        }
        continue;
      }

      if (prev.fingerprint !== fingerprint) {
        const ctx = await findContext(supabase, e.id, e.description);
        notifications.push([
          "*Reunião alterada*",
          "",
          `*${e.title}*`,
          `Antes: ${prev.start_at ? `${fmtDate(prev.start_at)} às ${fmtTime(prev.start_at)}` : "—"}`,
          `Agora: ${fmtWeekday(e.start)}, ${fmtDate(e.start)} às ${fmtTime(e.start)}`,
          ctx ? `\n${ctx.label}\n${ctx.link}` : null,
          e.meetingLink ? `\nLink: ${e.meetingLink}` : null,
        ].filter(Boolean).join("\n"));
        updated++;
        // horário mudou: os lembretes valem de novo
        await supabase.from("agenda_watch_events").upsert({
          ...row,
          notified_created: true,
          notified_30: false,
          notified_5: false,
        });
        continue;
      }

      // ── lembretes (30 e 5 minutos antes)
      const minsLeft = (startMs - now) / 60000;
      const patch: Record<string, unknown> = { ...row, notified_created: prev.notified_created };

      if (!prev.notified_30 && minsLeft <= 30 && minsLeft > 5) {
        const ctx = await findContext(supabase, e.id, e.description);
        notifications.push([
          "*Reunião em 30 minutos*",
          "",
          `*${e.title}* às ${fmtTime(e.start)}`,
          ctx ? `\n${ctx.label}\n${ctx.link}` : null,
          e.meetingLink ? `\nEntrar: ${e.meetingLink}` : "\n(sem link de vídeo no evento)",
        ].filter(Boolean).join("\n"));
        patch.notified_30 = true;
        reminders++;
      }
      if (!prev.notified_5 && minsLeft <= 5 && minsLeft > -2) {
        const ctx = await findContext(supabase, e.id, e.description);
        notifications.push([
          "*Reunião em 5 minutos*",
          "",
          `*${e.title}* às ${fmtTime(e.start)}`,
          ctx ? `\n${ctx.label}\n${ctx.link}` : null,
          e.meetingLink ? `\nEntrar: ${e.meetingLink}` : "\n(sem link de vídeo no evento)",
        ].filter(Boolean).join("\n"));
        patch.notified_5 = true;
        patch.notified_30 = true;
        reminders++;
      }

      await supabase.from("agenda_watch_events").upsert(patch);
    }

    // ── sumiu da agenda = cancelada (só avisa se ainda estava por vir)
    for (const [id, prev] of known) {
      if (seen.has(id) || prev.cancelled) continue;
      const startMs = prev.start_at ? new Date(prev.start_at).getTime() : 0;
      await supabase.from("agenda_watch_events")
        .update({ cancelled: true, updated_at: new Date().toISOString() })
        .eq("google_event_id", id);
      if (startMs > now) {
        notifications.push([
          "*Reunião cancelada*",
          "",
          `*${prev.title}*`,
          `Era ${fmtWeekday(prev.start_at)}, ${fmtDate(prev.start_at)} às ${fmtTime(prev.start_at)}`,
        ].join("\n"));
        cancelled++;
      }
    }

    for (const msg of notifications) {
      await sendWhatsApp(supabase, msg);
    }

    return json({ ok: true, mode, created, updated, cancelled, reminders, total_events: events.length });
  } catch (err) {
    console.error("[agenda-watch] erro:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
