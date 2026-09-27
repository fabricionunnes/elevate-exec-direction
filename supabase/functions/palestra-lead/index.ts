// Edge pública do QR Code da palestra (Conexão & Inovação, CDL Lafaiete, 01/10/2026).
// Fluxo: o participante lê o QR, preenche o formulário e escolhe o horário do diagnóstico
// gratuito na agenda do Ricardo. O lead entra no funil PALESTRA com a etiqueta do evento e a
// reunião é criada no Google Calendar dele e no CRM Comercial ao mesmo tempo.
//
// actions:
//   submit -> cria/atualiza o lead na etapa Triagem, aplica a etiqueta, devolve lead_id
//   slots  -> dias e horários livres na agenda do Ricardo (freebusy real do Google)
//   book   -> cria o evento no Google, grava crm_activities e move o lead pra Agendado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PIPELINE_ID = "e555eebf-6489-4605-ac65-a61ce8fb534a"; // funil PALESTRA
const STAGE_TRIAGEM = "d8f790ba-1a48-4800-8f10-93c84318dd37";
const STAGE_AGENDADO = "34d24cd8-120e-4c8f-bbdd-eba0bd5de4c4";
const ORIGIN_ID = "81be3947-9f10-4daa-8de6-ee872537ba6d"; // origem PALESTRA
const TAG_NAME = "Palestra CDL 01/10";
const CLOSER_STAFF_ID = "565dc606-c2f1-45ec-b06f-bccdc1c663e7"; // Ricardo Santos
const CLOSER_USER_ID = "a41403b5-32e5-4e44-aa0f-c08ae934f04d"; // conta Google do Ricardo
const CLOSER_NAME = "Ricardo Santos";
const EVENT_LABEL = "Palestra CDL 01/10";
const DURATION_MIN = 45;
const DAY_START = 9; // agenda oferecida ao participante: 09:00
const DAY_END = 18; // último slot termina até 18:00
const DAYS_AHEAD = 12; // janela de dias corridos varrida
const MAX_DAYS = 5; // dias com vaga devolvidos pro formulário
const MAX_SLOTS_PER_DAY = 8;

function onlyDigits(v: string): string {
  let d = (v || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2); // tira o DDI digitado
  return d.slice(0, 11);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** data (YYYY-MM-DD) dos próximos dias úteis, em horário de Brasília */
function nextBusinessDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000); // agora em BRT
  for (let i = 0; i < n && out.length < n; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // sem sábado e domingo
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const calendar = async (action: string, payload: Record<string, unknown>) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/google-calendar?action=${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  try {
    const body = await req.json();
    const action = body.action as string;

    // ------------------------------------------------------------------ submit
    if (action === "submit") {
      const name = String(body.name || "").trim();
      const phone = onlyDigits(String(body.phone || ""));
      const email = String(body.email || "").trim().toLowerCase();
      const company = String(body.company || "").trim();
      const instagram = String(body.instagram || "").trim().replace(/^@/, "");
      const revenue = String(body.revenue || "").trim();

      if (!name || phone.length < 10) {
        return json({ error: "Informe seu nome e um WhatsApp válido com DDD." }, 400);
      }

      const notes = [
        `Lead do QR Code da palestra Conexão & Inovação (CDL Lafaiete, 01/10/2026).`,
        company ? `Empresa: ${company}` : null,
        revenue ? `Faturamento: ${revenue}` : null,
        instagram ? `Instagram: @${instagram}` : null,
        `Pediu o diagnóstico comercial gratuito.`,
      ].filter(Boolean).join("\n");

      // dedup: mesmo telefone ou mesmo e-mail dentro do funil da palestra
      let existing: { id: string } | null = null;
      const { data: byPhone } = await supabase
        .from("crm_leads").select("id").eq("phone", phone).eq("pipeline_id", PIPELINE_ID).limit(1);
      if (byPhone?.length) existing = byPhone[0];
      if (!existing && email) {
        const { data: byEmail } = await supabase
          .from("crm_leads").select("id").eq("email", email).eq("pipeline_id", PIPELINE_ID).limit(1);
        if (byEmail?.length) existing = byEmail[0];
      }

      const payload: Record<string, unknown> = {
        name,
        phone,
        email: email || null,
        company: company || null,
        instagram: instagram ? `@${instagram}` : null,
        estimated_revenue: revenue || null,
        pipeline_id: PIPELINE_ID,
        stage_id: STAGE_TRIAGEM,
        origin: EVENT_LABEL,
        origin_id: ORIGIN_ID,
        closer_staff_id: CLOSER_STAFF_ID,
        owner_staff_id: CLOSER_STAFF_ID,
        notes,
        last_activity_at: new Date().toISOString(),
      };

      let leadId: string;
      if (existing) {
        await supabase.from("crm_leads").update(payload).eq("id", existing.id);
        leadId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from("crm_leads")
          .insert({ ...payload, entered_pipeline_at: new Date().toISOString() })
          .select("id").single();
        if (error || !created) {
          console.error("insert lead", error);
          return json({ error: "Não consegui registrar seus dados. Tenta de novo." }, 500);
        }
        leadId = created.id;
      }

      // etiqueta do evento (cria uma vez, reaproveita depois)
      let tagId: string | null = null;
      const { data: tag } = await supabase.from("crm_tags").select("id").eq("name", TAG_NAME).maybeSingle();
      if (tag) {
        tagId = tag.id;
      } else {
        const { data: newTag } = await supabase
          .from("crm_tags").insert({ name: TAG_NAME, color: "#39DA45" }).select("id").single();
        tagId = newTag?.id ?? null;
      }
      if (tagId) {
        const { data: link } = await supabase
          .from("crm_lead_tags").select("id").eq("lead_id", leadId).eq("tag_id", tagId).maybeSingle();
        if (!link) await supabase.from("crm_lead_tags").insert({ lead_id: leadId, tag_id: tagId });
      }

      return json({ lead_id: leadId });
    }

    // ------------------------------------------------------------------ slots
    if (action === "slots") {
      const dates = nextBusinessDays(DAYS_AHEAD);
      const results = await Promise.all(dates.map(async (date) => {
        const { ok, data } = await calendar("freebusy", {
          target_user_id: CLOSER_USER_ID,
          date,
          duration_minutes: DURATION_MIN,
        });
        if (!ok) return { date, slots: [] as string[] };
        const all: string[] = data.availableSlots || [];
        const slots = all.filter((t: string) => {
          const [h, m] = t.split(":").map(Number);
          const endMin = h * 60 + m + DURATION_MIN;
          return h >= DAY_START && endMin <= DAY_END * 60;
        }).slice(0, MAX_SLOTS_PER_DAY);
        return { date, slots };
      }));

      const days = results.filter((d) => d.slots.length > 0).slice(0, MAX_DAYS);
      return json({ days, duration: DURATION_MIN, closer: CLOSER_NAME });
    }

    // ------------------------------------------------------------------ book
    if (action === "book") {
      const leadId = String(body.lead_id || "");
      const date = String(body.date || "");
      const time = String(body.time || "");
      if (!leadId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
        return json({ error: "Escolha um horário válido." }, 400);
      }

      const { data: lead } = await supabase
        .from("crm_leads").select("id, name, company, email, phone").eq("id", leadId).maybeSingle();
      if (!lead) return json({ error: "Cadastro não encontrado." }, 404);

      const [h, m] = time.split(":").map(Number);
      const endMinutes = h * 60 + m + DURATION_MIN;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
      const startDateTime = `${date}T${time}:00-03:00`;
      const endDateTime = `${date}T${endTime}:00-03:00`;
      const who = lead.company ? `${lead.name} (${lead.company})` : lead.name;
      const title = `Diagnóstico Comercial UNV · ${who}`;
      const description = [
        `Diagnóstico comercial gratuito agendado pelo QR Code da palestra Conexão & Inovação.`,
        `Participante: ${lead.name}`,
        lead.company ? `Empresa: ${lead.company}` : null,
        `WhatsApp: ${lead.phone || "não informado"}`,
        lead.email ? `E-mail: ${lead.email}` : null,
      ].filter(Boolean).join("\n");

      const { ok, data } = await calendar("create-event", {
        title,
        description,
        startDateTime,
        endDateTime,
        attendees: lead.email ? [lead.email] : [],
        target_user_id: CLOSER_USER_ID,
      });

      if (!ok || !data?.success) {
        console.error("create-event falhou", data);
        return json({ error: "Não consegui reservar esse horário. Escolhe outro, por favor." }, 409);
      }

      const eventId = data.event?.id || null;
      const meetingLink = data.event?.meetingLink || null;
      const scheduledAt = new Date(startDateTime).toISOString();

      await supabase.from("crm_activities").insert({
        lead_id: leadId,
        type: "meeting",
        title,
        description,
        scheduled_at: scheduledAt,
        status: "pending",
        responsible_staff_id: CLOSER_STAFF_ID,
        meeting_link: meetingLink,
        google_calendar_event_id: eventId,
        google_calendar_user_id: CLOSER_USER_ID,
      });

      await supabase.from("crm_leads").update({
        stage_id: STAGE_AGENDADO,
        stage_entered_at: new Date().toISOString(),
        scheduled_at: scheduledAt,
        next_activity_at: scheduledAt,
        scheduled_by_staff_id: CLOSER_STAFF_ID,
        last_activity_at: new Date().toISOString(),
      }).eq("id", leadId);

      const [yy, mm, dd] = date.split("-");
      return json({
        success: true,
        meetingLink,
        closer: CLOSER_NAME,
        when: `${dd}/${mm}/${yy} às ${time}`,
        duration: DURATION_MIN,
      });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("palestra-lead", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
