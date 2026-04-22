// Edge Function: crm-cadence-dispatcher
// Roda via cron a cada minuto. Processa enrollments com next_run_at <= now()
// respeitando janela horária da cadência (ou global), envia mensagem WhatsApp
// (texto ou mídia), avalia ramificações condicionais conforme última resposta
// do lead, e agenda próximo step ou completa o enrollment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WindowConfig {
  window_start: string;
  window_end: string;
  weekdays: number[];
  timezone: string;
}

interface Branch {
  // operator: "contains" | "equals" | "starts_with" | "any"
  operator: string;
  // keywords (case-insensitive). Para "any" não precisa.
  keywords?: string[];
  // sort_order do step alvo dentro da cadência (não index). "complete" para encerrar.
  goto: number | "complete";
}

function normalizeTime(t: string): string {
  if (!t) return "00:00";
  const parts = t.split(":");
  const h = (parts[0] || "0").padStart(2, "0");
  const m = (parts[1] || "0").padStart(2, "0");
  return `${h}:${m}`;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = normalizeTime(t).split(":").map(Number);
  return h * 60 + m;
}

function isInsideWindow(now: Date, win: WindowConfig): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: win.timezone || "America/Sao_Paulo",
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const wdStr = parts.find((p) => p.type === "weekday")?.value || "";
  const hourStr = parts.find((p) => p.type === "hour")?.value || "0";
  const minStr = parts.find((p) => p.type === "minute")?.value || "0";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = wdMap[wdStr] ?? -1;
  if (!win.weekdays.includes(wd)) return false;
  const cur = parseInt(hourStr) * 60 + parseInt(minStr);
  return cur >= parseTimeToMinutes(win.window_start) && cur <= parseTimeToMinutes(win.window_end);
}

function nextWindowOpening(now: Date, win: WindowConfig): Date {
  const tz = win.timezone || "America/Sao_Paulo";
  const startHHMM = normalizeTime(win.window_start);
  for (let i = 0; i < 8; i++) {
    const candidate = new Date(now.getTime() + i * 86400000);
    const wdStr = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
      .formatToParts(candidate).find((p) => p.type === "weekday")?.value || "";
    const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const wd = wdMap[wdStr] ?? -1;
    if (!win.weekdays.includes(wd)) continue;
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(candidate);
    const target = new Date(`${dateStr}T${startHHMM}:00${tzOffsetString(tz, candidate)}`);
    if (isNaN(target.getTime())) continue;
    if (target > now) return target;
  }
  return new Date(now.getTime() + 3600000);
}

function tzOffsetString(tz: string, ref: Date): string {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
  const parts = dtf.formatToParts(ref);
  const offset = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-03";
  const m = offset.match(/GMT([+-]?\d{1,2}):?(\d{2})?/);
  if (!m) return "-03:00";
  const sign = m[1].startsWith("-") ? "-" : "+";
  const h = String(Math.abs(parseInt(m[1]))).padStart(2, "0");
  const mm = m[2] || "00";
  return `${sign}${h}:${mm}`;
}

function renderTemplate(tpl: string, vars: Record<string, string | null | undefined>): string {
  return (tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? "").toString());
}

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let p = raw.replace(/\D/g, "");
  if (p && !p.startsWith("55") && (p.length === 10 || p.length === 11)) p = "55" + p;
  return p;
}

function evaluateBranches(branches: Branch[], inboundText: string | null): Branch | null {
  if (!branches || branches.length === 0) return null;
  const text = (inboundText || "").toLowerCase().trim();
  for (const b of branches) {
    if (b.operator === "any") return b;
    if (!text) continue;
    const kws = (b.keywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean);
    if (kws.length === 0) continue;
    if (b.operator === "contains" && kws.some((k) => text.includes(k))) return b;
    if (b.operator === "equals" && kws.some((k) => text === k)) return b;
    if (b.operator === "starts_with" && kws.some((k) => text.startsWith(k))) return b;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: globalSetting } = await supabase
      .from("crm_settings").select("setting_value")
      .eq("setting_key", "cadence_global_window").maybeSingle();
    const globalWindow: WindowConfig = (globalSetting?.setting_value as any) || {
      window_start: "09:00", window_end: "18:00",
      weekdays: [1, 2, 3, 4, 5], timezone: "America/Sao_Paulo",
    };

    const now = new Date();
    console.log(`[cadence-dispatcher] tick now=${now.toISOString()} globalWindow=${JSON.stringify(globalWindow)}`);

    const { data: due, error: dueErr } = await supabase
      .from("crm_cadence_enrollments")
      .select("id, cadence_id, lead_id, current_step_index, last_inbound_at, last_inbound_text, last_message_sent_at, next_run_at")
      .eq("status", "active").lte("next_run_at", now.toISOString()).limit(100);

    if (dueErr) throw dueErr;
    console.log(`[cadence-dispatcher] due enrollments: ${due?.length ?? 0}`);
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0, sent = 0, failed = 0, skipped = 0, branched = 0;

    for (const enr of due) {
      processed++;
      try {
        const { data: cadence } = await supabase
          .from("crm_cadences").select("*").eq("id", enr.cadence_id).maybeSingle();
        if (!cadence || !cadence.is_active) {
          await supabase.from("crm_cadence_enrollments").update({ status: "stopped", stopped_reason: "cadence_inactive" }).eq("id", enr.id);
          continue;
        }

        const { data: steps } = await supabase
          .from("crm_cadence_steps").select("*").eq("cadence_id", cadence.id)
          .eq("is_active", true).order("sort_order", { ascending: true });
        if (!steps || steps.length === 0) {
          await supabase.from("crm_cadence_enrollments").update({ status: "completed", completed_at: now.toISOString() }).eq("id", enr.id);
          continue;
        }

        const step = steps[enr.current_step_index];
        if (!step) {
          await supabase.from("crm_cadence_enrollments").update({ status: "completed", completed_at: now.toISOString() }).eq("id", enr.id);
          continue;
        }

        const win: WindowConfig = {
          window_start: cadence.window_start || globalWindow.window_start,
          window_end: cadence.window_end || globalWindow.window_end,
          weekdays: cadence.window_weekdays || globalWindow.weekdays,
          timezone: cadence.timezone || globalWindow.timezone,
        };

        const inside = isInsideWindow(now, win);
        console.log(`[cadence-dispatcher] enr=${enr.id} cadence=${cadence.id} step_idx=${enr.current_step_index} window=${JSON.stringify(win)} inside=${inside}`);
        if (!inside) {
          const nextOpen = nextWindowOpening(now, win);
          console.log(`[cadence-dispatcher] enr=${enr.id} OUT_OF_WINDOW reschedule_to=${nextOpen.toISOString()}`);
          await supabase.from("crm_cadence_enrollments").update({ next_run_at: nextOpen.toISOString() }).eq("id", enr.id);
          continue;
        }

        // Ramificações: avaliar ANTES de enviar, com base na última resposta inbound após último envio
        const hasNewInbound = enr.last_inbound_at && (!enr.last_message_sent_at || new Date(enr.last_inbound_at) > new Date(enr.last_message_sent_at));
        const branches: Branch[] = Array.isArray(step.branches) ? step.branches : [];
        if (branches.length > 0 && hasNewInbound) {
          const matched = evaluateBranches(branches, enr.last_inbound_text);
          if (matched) {
            if (matched.goto === "complete") {
              await supabase.from("crm_cadence_enrollments").update({
                status: "completed", completed_at: now.toISOString(), stopped_reason: "branch_complete", next_run_at: null,
              }).eq("id", enr.id);
              branched++;
              continue;
            }
            const targetIdx = steps.findIndex((s: any) => s.sort_order === matched.goto);
            if (targetIdx >= 0) {
              const tStep = steps[targetIdx];
              const dMs = tStep.delay_unit === "minutes" ? tStep.delay_value * 60000
                : tStep.delay_unit === "hours" ? tStep.delay_value * 3600000
                : tStep.delay_value * 86400000;
              await supabase.from("crm_cadence_enrollments").update({
                current_step_index: targetIdx,
                next_run_at: new Date(now.getTime() + dMs).toISOString(),
              }).eq("id", enr.id);
              branched++;
              continue;
            }
          }
        }

        // Condição "no_reply"
        if (step.send_condition === "no_reply" && hasNewInbound) {
          await supabase.from("crm_cadence_messages").insert({
            enrollment_id: enr.id, cadence_id: cadence.id, step_id: step.id, lead_id: enr.lead_id,
            status: "skipped", error_message: "lead replied since last send",
          });
          skipped++;
          await advanceEnrollment(supabase, enr.id, enr.current_step_index, steps, now);
          continue;
        }

        const { data: lead } = await supabase
          .from("crm_leads").select("id, name, phone, company, owner_staff_id")
          .eq("id", enr.lead_id).maybeSingle();
        if (!lead) {
          await supabase.from("crm_cadence_enrollments").update({ status: "failed", stopped_reason: "lead_not_found" }).eq("id", enr.id);
          continue;
        }

        const phone = normalizePhone(lead.phone);
        if (!phone) {
          await supabase.from("crm_cadence_messages").insert({
            enrollment_id: enr.id, cadence_id: cadence.id, step_id: step.id, lead_id: enr.lead_id,
            status: "failed", error_message: "lead has no phone",
          });
          failed++;
          await advanceEnrollment(supabase, enr.id, enr.current_step_index, steps, now);
          continue;
        }

        // Resolver instância
        let instance: { id: string; instance_name: string; api_url: string; api_key: string } | null = null;
        if (step.instance_mode === "fixed" && step.whatsapp_instance_id) {
          const { data: inst } = await supabase.from("whatsapp_instances")
            .select("id, instance_name, api_url, api_key").eq("id", step.whatsapp_instance_id).maybeSingle();
          instance = inst as any;
        } else if (step.instance_mode === "from_owner" && lead.owner_staff_id) {
          const { data: staff } = await supabase.from("onboarding_staff")
            .select("default_whatsapp_instance_id").eq("id", lead.owner_staff_id).maybeSingle();
          if (staff?.default_whatsapp_instance_id) {
            const { data: inst } = await supabase.from("whatsapp_instances")
              .select("id, instance_name, api_url, api_key").eq("id", staff.default_whatsapp_instance_id).maybeSingle();
            instance = inst as any;
          } else {
            const { data: access } = await supabase
              .from("whatsapp_instance_access")
              .select("instance_id, whatsapp_instances(id, instance_name, api_url, api_key)")
              .eq("staff_id", lead.owner_staff_id).limit(1).maybeSingle();
            instance = (access as any)?.whatsapp_instances || null;
          }
        }

        if (!instance) {
          await supabase.from("crm_cadence_messages").insert({
            enrollment_id: enr.id, cadence_id: cadence.id, step_id: step.id, lead_id: enr.lead_id,
            phone, status: "failed", error_message: "no whatsapp instance resolved",
          });
          failed++;
          await advanceEnrollment(supabase, enr.id, enr.current_step_index, steps, now);
          continue;
        }

        // Próxima reunião agendada (para variáveis {{data_reuniao}} e {{link_reuniao}})
        const { data: nextMeeting } = await supabase
          .from("crm_activities")
          .select("scheduled_at, meeting_link")
          .eq("lead_id", lead.id)
          .eq("type", "meeting")
          .gte("scheduled_at", now.toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const firstName = lead.name?.split(" ")[0] || lead.name || "";
        const meetingDate = nextMeeting?.scheduled_at
          ? new Date(nextMeeting.scheduled_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          : "";
        const meetingLink = nextMeeting?.meeting_link || "";

        const vars = {
          nome: firstName,
          primeiro_nome: firstName,
          nome_completo: lead.name || "",
          empresa: lead.company || "",
          data_reuniao: meetingDate,
          link_reuniao: meetingLink,
        };

        const mediaType = step.media_type || "text";
        let resp: Response;
        let messageContent = "";

        if (mediaType === "text") {
          messageContent = renderTemplate(step.message_template, vars);
          resp = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: instance.api_key },
            body: JSON.stringify({ number: phone, text: messageContent }),
          });
        } else {
          // Mídia: image/video/document/audio
          const caption = renderTemplate(step.media_caption || step.message_template || "", vars);
          messageContent = caption ? `[${mediaType}] ${caption}` : `[${mediaType}]`;
          if (mediaType === "audio") {
            resp = await fetch(`${instance.api_url}/message/sendWhatsAppAudio/${instance.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: instance.api_key },
              body: JSON.stringify({ number: phone, audio: step.media_url }),
            });
          } else {
            resp = await fetch(`${instance.api_url}/message/sendMedia/${instance.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: instance.api_key },
              body: JSON.stringify({
                number: phone,
                mediatype: mediaType, // image | video | document
                media: step.media_url,
                caption,
                fileName: step.media_filename || undefined,
              }),
            });
          }
        }

        if (resp.ok) {
          await resp.text();
          await supabase.from("crm_cadence_messages").insert({
            enrollment_id: enr.id, cadence_id: cadence.id, step_id: step.id, lead_id: enr.lead_id,
            whatsapp_instance_id: instance.id, phone, message_content: messageContent,
            status: "sent", sent_at: now.toISOString(),
          });
          sent++;
          await advanceEnrollment(supabase, enr.id, enr.current_step_index, steps, now);
        } else {
          const errText = await resp.text();
          await supabase.from("crm_cadence_messages").insert({
            enrollment_id: enr.id, cadence_id: cadence.id, step_id: step.id, lead_id: enr.lead_id,
            whatsapp_instance_id: instance.id, phone, message_content: messageContent,
            status: "failed", error_message: errText.slice(0, 500),
          });
          failed++;
          await advanceEnrollment(supabase, enr.id, enr.current_step_index, steps, now);
        }
      } catch (e) {
        console.error("[cadence-dispatcher] enrollment error:", e);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, sent, failed, skipped, branched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cadence-dispatcher] fatal:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function advanceEnrollment(supabase: any, enrollmentId: string, currentIdx: number, steps: any[], now: Date) {
  const nextIdx = currentIdx + 1;
  if (nextIdx >= steps.length) {
    await supabase.from("crm_cadence_enrollments").update({
      status: "completed", completed_at: now.toISOString(),
      last_message_sent_at: now.toISOString(), current_step_index: nextIdx, next_run_at: null,
    }).eq("id", enrollmentId);
    return;
  }
  const nextStep = steps[nextIdx];
  const delayMs = nextStep.delay_unit === "minutes" ? nextStep.delay_value * 60000
    : nextStep.delay_unit === "hours" ? nextStep.delay_value * 3600000
    : nextStep.delay_value * 86400000;
  const nextRun = new Date(now.getTime() + delayMs);
  await supabase.from("crm_cadence_enrollments").update({
    current_step_index: nextIdx,
    last_message_sent_at: now.toISOString(),
    next_run_at: nextRun.toISOString(),
  }).eq("id", enrollmentId);
}
