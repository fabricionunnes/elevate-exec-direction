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
const AGENT_ID = "7dfa6491-399c-4da8-8a43-c36751b355bc"; // agente Natália - Palestra CDL 01/10
const WA_INSTANCE_ID = "95278a26-7618-4b19-8f8c-67c925b733e5"; // instância natalia-amador
const CHASE_AFTER_MIN = 25; // minutos em Triagem sem agendar até a Natália puxar
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


/** envia texto pela instância da Natália (Evolution ou Stevo Manager V2) */
async function sendWhatsApp(supabase: any, phone: string, message: string) {
  const { data: inst } = await supabase.from("whatsapp_instances")
    .select("id, instance_name, api_url, api_key, provider_type, status").eq("id", WA_INSTANCE_ID).maybeSingle();
  if (!inst) return { ok: false, error: "instância não encontrada" };
  const apiUrl = inst.api_url || Deno.env.get("EVOLUTION_API_URL");
  const apiKey = inst.api_key || Deno.env.get("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return { ok: false, error: "instância sem api_url/api_key" };
  const baseUrl = String(apiUrl).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  let isV2 = inst.provider_type === "manager_v2";
  try { if (!isV2) isV2 = new URL(baseUrl).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { /* noop */ }
  const sendUrl = isV2 ? `${baseUrl}/send/text` : `${baseUrl}/message/sendText/${inst.instance_name}`;
  const headers: Record<string, string> = isV2
    ? { "Content-Type": "application/json", apikey: apiKey }
    : { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}` };
  const resp = await fetch(sendUrl, { method: "POST", headers, body: JSON.stringify({ number: phone, text: message, delay: 0 }) });
  if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}: ${(await resp.text()).slice(0, 140)}` };
  let remoteId: string | null = null;
  try { const d = await resp.json(); remoteId = d?.key?.id || d?.data?.key?.id || d?.messageId || d?.id || null; } catch { /* corpo não-JSON */ }
  return { ok: true, remoteId, isV2 };
}

/** abre a conversa do lead na instância da Natália, manda a primeira mensagem e liga o agente nela */
async function abrirConversa(supabase: any, lead: any, texto: string) {
  const digits = String(lead.phone || "").replace(/\D/g, "");
  if (digits.length < 10) return { ok: false, error: "telefone inválido" };
  const full = digits.startsWith("55") ? digits : `55${digits}`;

  // contato
  let contactId: string | null = null;
  const { data: ct } = await supabase.from("crm_whatsapp_contacts").select("id").eq("phone", full).maybeSingle();
  if (ct) {
    contactId = ct.id;
    await supabase.from("crm_whatsapp_contacts").update({ name: lead.name, lead_id: lead.id }).eq("id", ct.id);
  } else {
    const { data: novo } = await supabase.from("crm_whatsapp_contacts")
      .insert({ phone: full, name: lead.name, lead_id: lead.id }).select("id").single();
    contactId = novo?.id ?? null;
  }
  if (!contactId) return { ok: false, error: "não consegui criar o contato" };

  // conversa nessa instância
  let convId: string | null = null;
  const { data: cv } = await supabase.from("crm_whatsapp_conversations")
    .select("id").eq("instance_id", WA_INSTANCE_ID).eq("contact_id", contactId).maybeSingle();
  if (cv) {
    convId = cv.id;
    await supabase.from("crm_whatsapp_conversations").update({ lead_id: lead.id, status: "open" }).eq("id", cv.id);
  } else {
    const { data: nova } = await supabase.from("crm_whatsapp_conversations")
      .insert({ instance_id: WA_INSTANCE_ID, contact_id: contactId, lead_id: lead.id, status: "open", unread_count: 0 })
      .select("id").single();
    convId = nova?.id ?? null;
  }
  if (!convId) return { ok: false, error: "não consegui abrir a conversa" };

  // envia a abertura
  const sent = await sendWhatsApp(supabase, full, texto);
  if (sent.ok) {
    // Evolution não ecoa o que a própria API manda, então gravamos aqui
    if (!sent.isV2) {
      await supabase.from("crm_whatsapp_messages").insert({
        conversation_id: convId, content: texto, type: "text", direction: "outbound",
        status: "sent", remote_id: sent.remoteId || null, is_ai: true, sent_by: null,
      });
    }
    await supabase.from("crm_whatsapp_conversations").update({
      last_message: texto.substring(0, 255), last_message_at: new Date().toISOString(),
      last_message_direction: "outbound",
    }).eq("id", convId);
  }

  // liga o agente da palestra nessa conversa para ele seguir o papo
  await supabase.from("crm_ai_agent_conversation_overrides").upsert({
    agent_id: AGENT_ID, conversation_id: convId, channel: "whatsapp", enabled: true, reply_mode: "auto",
  }, { onConflict: "conversation_id,channel" });

  return { ok: sent.ok, error: sent.error, conversation_id: convId };
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
      // O freebusy do Google demora alguns segundos pra enxergar um evento recém-criado.
      // Então a fonte da verdade imediata é a nossa própria agenda no CRM.
      const { data: marcadas } = await supabase
        .from("crm_activities")
        .select("scheduled_at")
        .eq("type", "meeting")
        .eq("responsible_staff_id", CLOSER_STAFF_ID)
        .not("status", "in", "(cancelled,canceled,no_show)")
        .gte("scheduled_at", new Date().toISOString())
        .lte("scheduled_at", new Date(Date.now() + (DAYS_AHEAD + 2) * 24 * 3600 * 1000).toISOString());
      const ocupados = (marcadas || []).map((m: any) => new Date(m.scheduled_at).getTime());
      const colide = (date: string, hhmm: string) => {
        const ini = new Date(`${date}T${hhmm}:00-03:00`).getTime();
        const fim = ini + DURATION_MIN * 60000;
        return ocupados.some((o) => ini < o + DURATION_MIN * 60000 && fim > o);
      };
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
          if (h < DAY_START || endMin > DAY_END * 60) return false;
          return !colide(date, t);
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

      const inicioMs = new Date(startDateTime).getTime();
      const fimMs = inicioMs + DURATION_MIN * 60000;
      const janelaIni = new Date(inicioMs - DURATION_MIN * 60000).toISOString();
      const janelaFim = new Date(fimMs + DURATION_MIN * 60000).toISOString();

      const conflita = (lista: any[], ignorarId?: string) => lista.some((m: any) => {
        if (ignorarId && m.id === ignorarId) return false;
        const o = new Date(m.scheduled_at).getTime();
        return inicioMs < o + DURATION_MIN * 60000 && fimMs > o;
      });

      // 1) alguém já tem esse horário com o mesmo closer?
      const { data: jaMarcadas } = await supabase
        .from("crm_activities").select("id, lead_id, scheduled_at")
        .eq("type", "meeting").eq("responsible_staff_id", CLOSER_STAFF_ID)
        .not("status", "in", "(cancelled,canceled,no_show)")
        .gte("scheduled_at", janelaIni).lte("scheduled_at", janelaFim);
      if (conflita(jaMarcadas || [], undefined)) {
        const meu = (jaMarcadas || []).find((m: any) => m.lead_id === leadId
          && new Date(m.scheduled_at).getTime() === inicioMs);
        if (!meu) return json({ error: "Esse horário acabou de ser ocupado. Escolhe outro, por favor." }, 409);
      }

      // 2) reserva primeiro no banco, depois confere quem chegou antes.
      // Duas pessoas escolhendo o mesmo horário no mesmo segundo: quem reservou
      // primeiro fica, a outra recebe 409 e escolhe de novo.
      const { data: reserva, error: errReserva } = await supabase.from("crm_activities").insert({
        lead_id: leadId, type: "meeting", title, description,
        scheduled_at: new Date(inicioMs).toISOString(), status: "pending",
        responsible_staff_id: CLOSER_STAFF_ID, google_calendar_user_id: CLOSER_USER_ID,
      }).select("id, created_at").single();
      if (errReserva || !reserva) {
        console.error("reserva", errReserva);
        return json({ error: "Não consegui reservar esse horário. Tenta de novo." }, 500);
      }

      const { data: concorrentes } = await supabase
        .from("crm_activities").select("id, scheduled_at, created_at")
        .eq("type", "meeting").eq("responsible_staff_id", CLOSER_STAFF_ID)
        .not("status", "in", "(cancelled,canceled,no_show)")
        .gte("scheduled_at", janelaIni).lte("scheduled_at", janelaFim);
      const perdeuACorrida = (concorrentes || []).some((m: any) =>
        m.id !== reserva.id
        && new Date(m.scheduled_at).getTime() < fimMs
        && new Date(m.scheduled_at).getTime() + DURATION_MIN * 60000 > inicioMs
        && m.created_at <= reserva.created_at);
      if (perdeuACorrida) {
        await supabase.from("crm_activities").delete().eq("id", reserva.id);
        return json({ error: "Esse horário acabou de ser ocupado. Escolhe outro, por favor." }, 409);
      }

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
        await supabase.from("crm_activities").delete().eq("id", reserva.id);
        return json({ error: "Não consegui reservar esse horário. Escolhe outro, por favor." }, 409);
      }

      const eventId = data.event?.id || null;
      const meetingLink = data.event?.meetingLink || null;
      const scheduledAt = new Date(startDateTime).toISOString();

      await supabase.from("crm_activities").update({
        meeting_link: meetingLink,
        google_calendar_event_id: eventId,
      }).eq("id", reserva.id);

      await supabase.from("crm_leads").update({
        stage_id: STAGE_AGENDADO,
        stage_entered_at: new Date().toISOString(),
        scheduled_at: scheduledAt,
        next_activity_at: scheduledAt,
        scheduled_by_staff_id: CLOSER_STAFF_ID,
        last_activity_at: new Date().toISOString(),
      }).eq("id", leadId);

      // a Natália abre a conversa no WhatsApp e assume daqui pra frente
      const [yy0, mm0, dd0] = date.split("-");
      const primeiro = String(lead.name || "").trim().split(" ")[0];
      const abertura = `Oi ${primeiro}, aqui é a Natália, do time do Fabrício Nunnes. Vi que você garantiu o seu diagnóstico gratuito lá na palestra da CDL. Ficou pra ${dd0}/${mm0} às ${time}, por videochamada, com um especialista do time.\n\nAntes do dia eu queria entender um pouco${lead.company ? " da " + lead.company : " do seu negócio"} pra ele já chegar com o dever de casa feito. Posso te fazer umas perguntas rápidas?`;
      try {
        const r = await abrirConversa(supabase, lead, abertura);
        if (!r.ok) console.error("abrirConversa (book)", r.error);
      } catch (e) { console.error("abrirConversa (book) exception", e); }

      const [yy, mm, dd] = date.split("-");
      return json({
        success: true,
        meetingLink,
        closer: CLOSER_NAME,
        when: `${dd}/${mm}/${yy} às ${time}`,
        duration: DURATION_MIN,
      });
    }

    // ------------------------------------------------------------------ chase (cron)
    // Quem preencheu o formulário e não escolheu horário fica parado na Triagem.
    // Passados alguns minutos, a Natália puxa a conversa no WhatsApp.
    if (action === "chase") {
      const corte = new Date(Date.now() - CHASE_AFTER_MIN * 60 * 1000).toISOString();
      const { data: parados } = await supabase
        .from("crm_leads")
        .select("id, name, phone, company, created_at")
        .eq("pipeline_id", PIPELINE_ID)
        .eq("stage_id", STAGE_TRIAGEM)
        .eq("origin", EVENT_LABEL)
        .lt("created_at", corte)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .limit(20);

      const feitos: string[] = [];
      for (const lead of (parados || [])) {
        // já existe conversa com mensagem nossa? então não chama de novo
        const digits = String(lead.phone || "").replace(/\D/g, "");
        const full = digits.startsWith("55") ? digits : `55${digits}`;
        const { data: ct } = await supabase.from("crm_whatsapp_contacts").select("id").eq("phone", full).maybeSingle();
        if (ct) {
          const { data: cv } = await supabase.from("crm_whatsapp_conversations")
            .select("id, last_message_at").eq("instance_id", WA_INSTANCE_ID).eq("contact_id", ct.id).maybeSingle();
          if (cv?.last_message_at) continue;
        }
        const primeiro = String(lead.name || "").trim().split(" ")[0];
        const texto = `Oi ${primeiro}, aqui é a Natália, do time do Fabrício Nunnes. Vi que você começou a marcar o seu diagnóstico gratuito lá na palestra da CDL mas não chegou a escolher o horário.\n\nQuer que eu veja os horários com você? Tenho agenda essa semana e a próxima.`;
        if (body.dry_run) { feitos.push(`${lead.name} (simulado)`); continue; }
        const r = await abrirConversa(supabase, lead, texto);
        if (r.ok) feitos.push(lead.name); else console.error("chase", lead.id, r.error);
      }
      return json({ ok: true, chamados: feitos.length, leads: feitos });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("palestra-lead", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
