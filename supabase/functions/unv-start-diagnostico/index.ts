// Bônus de quem compra o UNV Start: diagnóstico comercial gratuito com o time da UNV.
// A página de obrigado (/#/start/obrigado?token=...) chama esta função com o token de acesso
// do comprador. Nome, WhatsApp e e-mail já vêm da compra; o formulário só pede faturamento e
// Instagram. Os horários saem da agenda real do closer (freebusy do Google + reuniões já gravadas
// no CRM), de segunda a sexta, das 08h às 18h. Ao agendar, o evento vai pro Google do closer
// com Meet, a reunião entra em crm_activities e o lead vai pra "Reunião agendada" no funil UNV Start.
//
// actions:
//   context -> primeiro nome e se já existe reunião marcada (pra página não oferecer de novo)
//   submit  -> grava faturamento e Instagram no lead do CRM
//   slots   -> dias e horários livres na agenda do closer
//   book    -> reserva, cria o evento no Google e move o lead
//
// Deploy manual pela Management API (fora do CI), verify_jwt = false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PIPELINE_ID = "b4f2e8bb-3c88-4ad9-b157-b4b265d39ade"; // funil UNV Start
const STAGE_AGENDADO = "aedf63d8-cbf8-4d5a-8ee3-5c69b92fdb62"; // Reunião agendada
const CLOSER_STAFF_ID = "565dc606-c2f1-45ec-b06f-bccdc1c663e7"; // Ricardo Santos
const CLOSER_USER_ID = "a41403b5-32e5-4e44-aa0f-c08ae934f04d"; // conta Google do Ricardo
const CLOSER_NAME = "Ricardo Santos";
const DURATION_MIN = 45;
const DAY_START = 8; // primeiro horário: 08:00
const DAY_END = 18; // a reunião termina até 18:00
const DAYS_AHEAD = 14; // dias corridos varridos
const MAX_DAYS = 6; // dias com vaga devolvidos
const MAX_SLOTS_PER_DAY = 24;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanPhone(v: string): string {
  let d = (v || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

/** próximos dias úteis (YYYY-MM-DD) em horário de Brasília, a partir de hoje */
function nextBusinessDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
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

  /** comprador pelo token de acesso + o lead dele no funil UNV Start (cria se ainda não existir) */
  const resolver = async (token: string) => {
    if (!token || token.length < 16) return null;
    const { data: m } = await supabase
      .from("unv_start_members")
      .select("id, name, email, whatsapp, company_name, nexus_crm_lead_id, payment_status")
      .eq("access_token", token)
      .maybeSingle();
    if (!m || m.payment_status !== "paid") return null;

    let leadId: string | null = m.nexus_crm_lead_id || null;
    if (leadId) {
      const { data: l } = await supabase.from("crm_leads").select("id").eq("id", leadId).maybeSingle();
      if (!l) leadId = null;
    }
    if (!leadId) {
      const tel = cleanPhone(m.whatsapp || "");
      const ors = [
        m.email ? `email.ilike.${String(m.email).replace(/[,()]/g, "")}` : null,
        tel ? `phone.eq.${tel}` : null,
        tel ? `phone.eq.55${tel}` : null,
      ].filter(Boolean).join(",");
      if (ors) {
        const { data: ex } = await supabase.from("crm_leads").select("id")
          .eq("pipeline_id", PIPELINE_ID).or(ors).order("created_at", { ascending: false }).limit(1).maybeSingle();
        leadId = ex?.id || null;
      }
    }
    if (!leadId) {
      const now = new Date().toISOString();
      const { data: novo } = await supabase.from("crm_leads").insert({
        name: m.name, phone: cleanPhone(m.whatsapp || "") || null, email: m.email || null,
        company: m.company_name || null, origin: "UNV Start", pipeline_id: PIPELINE_ID,
        stage_id: "c01805e2-449a-4fd8-9be0-654f5d418fb4", tenant_id: null,
        entered_pipeline_at: now, stage_entered_at: now, last_activity_at: now,
        notes: "Comprou o UNV Start (R$ 97/mês).",
      }).select("id").single();
      leadId = novo?.id || null;
    }
    if (leadId && leadId !== m.nexus_crm_lead_id) {
      await supabase.from("unv_start_members").update({ nexus_crm_lead_id: leadId }).eq("id", m.id);
    }
    return leadId ? { member: m, leadId } : null;
  };

  try {
    const body = await req.json();
    const action = String(body.action || "");

    // ------------------------------------------------------------------ slots (não precisa de token)
    if (action === "slots") {
      const dates = nextBusinessDays(DAYS_AHEAD);
      // o freebusy do Google demora a enxergar evento recém-criado: as reuniões gravadas no CRM
      // são a fonte imediata
      const { data: marcadas } = await supabase
        .from("crm_activities").select("scheduled_at")
        .eq("type", "meeting").eq("responsible_staff_id", CLOSER_STAFF_ID)
        .not("status", "in", "(cancelled,canceled,no_show)")
        .gte("scheduled_at", new Date().toISOString())
        .lte("scheduled_at", new Date(Date.now() + (DAYS_AHEAD + 2) * 24 * 3600 * 1000).toISOString());
      const ocupados = (marcadas || []).map((x: any) => new Date(x.scheduled_at).getTime());
      const minimo = Date.now() + 2 * 60 * 60 * 1000; // pelo menos 2h de antecedência
      const results = await Promise.all(dates.map(async (date) => {
        const { ok, data } = await calendar("freebusy", { target_user_id: CLOSER_USER_ID, date, duration_minutes: DURATION_MIN });
        if (!ok) return { date, slots: [] as string[] };
        const all: string[] = data.availableSlots || [];
        const slots = all.filter((t: string) => {
          const [h, mi] = t.split(":").map(Number);
          if (h < DAY_START || h * 60 + mi + DURATION_MIN > DAY_END * 60) return false;
          const ini = new Date(`${date}T${t}:00-03:00`).getTime();
          if (ini < minimo) return false;
          const fim = ini + DURATION_MIN * 60000;
          return !ocupados.some((o) => ini < o + DURATION_MIN * 60000 && fim > o);
        }).slice(0, MAX_SLOTS_PER_DAY);
        return { date, slots };
      }));
      return json({ days: results.filter((d) => d.slots.length > 0).slice(0, MAX_DAYS), duration: DURATION_MIN });
    }

    const ctx = await resolver(String(body.token || ""));
    if (!ctx) return json({ error: "Não encontrei a sua compra. Abra pelo link que chegou no seu WhatsApp." }, 404);
    const { member, leadId } = ctx;

    // ------------------------------------------------------------------ context
    if (action === "context") {
      const { data: marcada } = await supabase
        .from("crm_activities").select("scheduled_at, meeting_link")
        .eq("lead_id", leadId).eq("type", "meeting")
        .not("status", "in", "(cancelled,canceled,no_show)")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true }).limit(1).maybeSingle();
      return json({
        first_name: String(member.name || "").trim().split(" ")[0],
        booked: marcada ? { scheduled_at: marcada.scheduled_at, meeting_link: marcada.meeting_link } : null,
      });
    }

    // ------------------------------------------------------------------ submit
    if (action === "submit") {
      const revenue = String(body.revenue || "").trim().slice(0, 60);
      const instagram = String(body.instagram || "").trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").slice(0, 60);
      if (!revenue) return json({ error: "Escolha a faixa de faturamento." }, 400);
      const { data: lead } = await supabase.from("crm_leads").select("notes").eq("id", leadId).maybeSingle();
      const nota = [
        "Pediu o bônus do UNV Start: diagnóstico comercial gratuito com o time.",
        `Faturamento: ${revenue}`,
        instagram ? `Instagram: @${instagram}` : null,
      ].filter(Boolean).join("\n");
      await supabase.from("crm_leads").update({
        estimated_revenue: revenue,
        ...(instagram ? { instagram: `@${instagram}` } : {}),
        closer_staff_id: CLOSER_STAFF_ID,
        notes: String(lead?.notes || "").includes("Pediu o bônus do UNV Start") ? lead?.notes : [lead?.notes, nota].filter(Boolean).join("\n"),
        last_activity_at: new Date().toISOString(),
      }).eq("id", leadId);
      return json({ ok: true });
    }

    // ------------------------------------------------------------------ book
    if (action === "book") {
      const date = String(body.date || "");
      const time = String(body.time || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return json({ error: "Escolha um horário válido." }, 400);
      const [h, mi] = time.split(":").map(Number);
      const dow = new Date(`${date}T12:00:00-03:00`).getUTCDay();
      if (dow === 0 || dow === 6 || h < DAY_START || h * 60 + mi + DURATION_MIN > DAY_END * 60) {
        return json({ error: "Esse horário está fora da agenda. Escolha outro, por favor." }, 400);
      }

      const { data: lead } = await supabase.from("crm_leads")
        .select("id, name, company, email, phone, instagram, estimated_revenue").eq("id", leadId).maybeSingle();
      if (!lead) return json({ error: "Cadastro não encontrado." }, 404);

      const endMin = h * 60 + mi + DURATION_MIN;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
      const startDateTime = `${date}T${time}:00-03:00`;
      const endDateTime = `${date}T${endTime}:00-03:00`;
      const who = lead.company ? `${lead.name} (${lead.company})` : lead.name;
      const title = `Diagnóstico Comercial UNV · ${who}`;
      const description = [
        "Diagnóstico comercial gratuito, bônus de quem assinou o UNV Start (Raio-X Comercial).",
        `Cliente: ${lead.name}`,
        lead.company ? `Empresa: ${lead.company}` : null,
        lead.estimated_revenue ? `Faturamento: ${lead.estimated_revenue}` : null,
        lead.instagram ? `Instagram: ${lead.instagram}` : null,
        `WhatsApp: ${lead.phone || "não informado"}`,
        lead.email ? `E-mail: ${lead.email}` : null,
      ].filter(Boolean).join("\n");

      const inicioMs = new Date(startDateTime).getTime();
      const fimMs = inicioMs + DURATION_MIN * 60000;
      if (inicioMs < Date.now() + 60 * 60 * 1000) return json({ error: "Esse horário já passou. Escolha outro, por favor." }, 409);
      const janelaIni = new Date(inicioMs - DURATION_MIN * 60000).toISOString();
      const janelaFim = new Date(fimMs + DURATION_MIN * 60000).toISOString();

      // 1) já tem alguém com o closer nesse horário?
      const { data: jaMarcadas } = await supabase.from("crm_activities").select("id, lead_id, scheduled_at")
        .eq("type", "meeting").eq("responsible_staff_id", CLOSER_STAFF_ID)
        .not("status", "in", "(cancelled,canceled,no_show)")
        .gte("scheduled_at", janelaIni).lte("scheduled_at", janelaFim);
      const choca = (jaMarcadas || []).some((x: any) => {
        const o = new Date(x.scheduled_at).getTime();
        return inicioMs < o + DURATION_MIN * 60000 && fimMs > o;
      });
      if (choca) return json({ error: "Esse horário acabou de ser ocupado. Escolha outro, por favor." }, 409);

      // 2) reserva primeiro no banco; se duas pessoas pegarem o mesmo horário no mesmo segundo,
      // quem reservou antes fica e a outra recebe 409
      const { data: reserva, error: errReserva } = await supabase.from("crm_activities").insert({
        lead_id: leadId, type: "meeting", title, description,
        scheduled_at: new Date(inicioMs).toISOString(), status: "pending",
        responsible_staff_id: CLOSER_STAFF_ID, google_calendar_user_id: CLOSER_USER_ID,
      }).select("id, created_at").single();
      if (errReserva || !reserva) {
        console.error("reserva", errReserva);
        return json({ error: "Não consegui reservar esse horário. Tente de novo." }, 500);
      }
      const { data: concorrentes } = await supabase.from("crm_activities").select("id, scheduled_at, created_at")
        .eq("type", "meeting").eq("responsible_staff_id", CLOSER_STAFF_ID)
        .not("status", "in", "(cancelled,canceled,no_show)")
        .gte("scheduled_at", janelaIni).lte("scheduled_at", janelaFim);
      const perdeu = (concorrentes || []).some((x: any) =>
        x.id !== reserva.id
        && new Date(x.scheduled_at).getTime() < fimMs
        && new Date(x.scheduled_at).getTime() + DURATION_MIN * 60000 > inicioMs
        && x.created_at <= reserva.created_at);
      if (perdeu) {
        await supabase.from("crm_activities").delete().eq("id", reserva.id);
        return json({ error: "Esse horário acabou de ser ocupado. Escolha outro, por favor." }, 409);
      }

      // 3) confirma no Google do closer (evento + Meet)
      const { ok, data } = await calendar("create-event", {
        title, description, startDateTime, endDateTime,
        attendees: lead.email ? [lead.email] : [],
        target_user_id: CLOSER_USER_ID,
      });
      if (!ok || !data?.success) {
        console.error("create-event", data);
        await supabase.from("crm_activities").delete().eq("id", reserva.id);
        return json({ error: "Não consegui reservar esse horário. Escolha outro, por favor." }, 409);
      }
      const meetingLink = data.event?.meetingLink || null;
      await supabase.from("crm_activities").update({
        meeting_link: meetingLink, google_calendar_event_id: data.event?.id || null,
      }).eq("id", reserva.id);

      const agora = new Date().toISOString();
      const scheduledAt = new Date(inicioMs).toISOString();
      await supabase.from("crm_leads").update({
        stage_id: STAGE_AGENDADO, stage_entered_at: agora,
        scheduled_at: scheduledAt, next_activity_at: scheduledAt,
        scheduled_by_staff_id: CLOSER_STAFF_ID, closer_staff_id: CLOSER_STAFF_ID,
        last_activity_at: agora,
      }).eq("id", leadId);

      const [yy, mm, dd] = date.split("-");
      return json({ success: true, meetingLink, closer: CLOSER_NAME, when: `${dd}/${mm}/${yy} às ${time}`, duration: DURATION_MIN, lead_id: leadId });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("unv-start-diagnostico", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
