import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// ---------- Resolução de modo do agente por conversa ----------
// Regra: se o agente tem QUALQUER funil configurado (aba "Funis" = allowlist),
// ele só atende leads em funis configurados — os demais funis e conversas sem
// funil ficam "off". Sem nenhum funil configurado, usa o padrão do agente
// (modo global, retrocompatível). O override manual da conversa sempre vence.
async function resolveAgentMode(
  supabase: any,
  agent: any,
  leadId: string | null,
  override: { enabled?: boolean; reply_mode?: string } | null,
): Promise<string> {
  if (override && override.enabled === false) return "off";
  if (override && (override.reply_mode || override.enabled === true)) {
    return override.reply_mode || agent.reply_mode || "copilot";
  }
  const { data: binds } = await supabase.from("crm_ai_agent_pipelines")
    .select("pipeline_id, reply_mode").eq("agent_id", agent.id);
  const bindList = binds || [];
  // Sem funis configurados => modo global (padrão do agente vale pra todos)
  if (bindList.length === 0) return agent.reply_mode || "copilot";
  // Allowlist por funil: precisa estar num funil configurado
  let leadPid: string | null = null;
  if (leadId) {
    const { data: lead } = await supabase.from("crm_leads").select("pipeline_id").eq("id", leadId).maybeSingle();
    leadPid = lead?.pipeline_id || null;
  }
  const bind = leadPid ? bindList.find((b: any) => b.pipeline_id === leadPid) : null;
  return bind?.reply_mode || "off";
}

// ---------- Envio WhatsApp (mesmo transporte do survey-sender: Stevo/Manager V2 vs Evolution legado) ----------
async function sendWhatsAppText(supabase: any, instanceId: string, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name, api_url, api_key, provider_type, status")
    .eq("id", instanceId).maybeSingle();
  if (!instance) return { ok: false, error: "instância não encontrada" };
  const apiUrl = instance.api_url || Deno.env.get("EVOLUTION_API_URL");
  const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return { ok: false, error: "instância sem api_url/api_key" };
  const baseUrl = String(apiUrl).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  let isV2 = instance.provider_type === "manager_v2";
  try { if (!isV2) isV2 = new URL(baseUrl).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { /* noop */ }

  // O webhook do Stevo baixa o status='disconnected' em eventos transitórios
  // (Disconnected/QR de reconexão de socket) mesmo com o telefone conectado.
  // Então NÃO confiamos cegamente no status do banco: se ele diz desconectado,
  // conferimos o status REAL no Stevo e, se estiver conectado, autocorrigimos.
  if (instance.status !== "connected") {
    let reallyConnected = false;
    if (isV2) {
      try {
        const r = await fetch(`${baseUrl}/instance/status`, { headers: { "Content-Type": "application/json", apikey: apiKey } });
        if (r.ok) {
          const d = await r.json();
          const p = d?.data ?? d;
          // Stevo retorna { data: { Connected: true, LoggedIn: true } } (maiúsculas)
          const flag = (o: any) => o?.connected ?? o?.Connected ?? o?.loggedIn ?? o?.LoggedIn;
          const state = String(p?.state ?? p?.status ?? p?.State ?? p?.Status ?? d?.state ?? d?.status ?? "").toLowerCase();
          reallyConnected = flag(p) === true || flag(d) === true
            || ["open", "connected", "online", "loggedin", "logged_in"].includes(state);
        }
      } catch { /* se a checagem falhar, mantém como desconectado */ }
    }
    if (!reallyConnected) return { ok: false, error: `instância ${instance.instance_name} desconectada` };
    // autocorrige o banco pra não bloquear os próximos envios / o indicador do inbox
    await supabase.from("whatsapp_instances").update({ status: "connected" }).eq("id", instanceId);
  }
  const sendUrl = isV2 ? `${baseUrl}/send/text` : `${baseUrl}/message/sendText/${instance.instance_name}`;
  const headers: Record<string, string> = isV2
    ? { "Content-Type": "application/json", apikey: apiKey }
    : { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}` };
  const resp = await fetch(sendUrl, { method: "POST", headers, body: JSON.stringify({ number: phone, text: message, delay: 0 }) });
  if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}: ${(await resp.text()).slice(0, 120)}` };
  return { ok: true };
}

// ---------- Horário de atendimento ----------
// work_schedule (grade semanal): { "0": [["08:00","12:00"],["20:00","08:00"]], ... }
// chave = dia da semana (0=domingo, fuso Brasília); faixa com fim < início vira a
// madrugada e TERMINA no dia seguinte (ex: seg 20:00→08:00 cobre ter 00:00-08:00).
function agentScheduleActive(agent: any): boolean {
  if (!agent.work_hours_enabled) return true; // sem janela = 24h
  const br = new Date(Date.now() - 3 * 3600000);
  const dow = br.getUTCDay();
  const mins = br.getUTCHours() * 60 + br.getUTCMinutes();
  const sched = agent.work_schedule;
  if (sched && typeof sched === "object") {
    const toMin = (v: string) => {
      const [h, m] = String(v).split(":").map((x) => parseInt(x, 10));
      return (h || 0) * 60 + (m || 0);
    };
    const check = (dayKey: number, spillover: boolean): boolean => {
      const ivs = (sched as any)[String(dayKey)];
      if (!Array.isArray(ivs)) return false;
      for (const iv of ivs) {
        if (!Array.isArray(iv) || iv.length < 2) continue;
        const a = toMin(iv[0]), b = toMin(iv[1]);
        if (a === b) continue;
        if (spillover) {
          // madrugada herdada do dia anterior (faixa que virou a noite)
          if (b < a && mins < b) return true;
        } else if (b > a) {
          if (mins >= a && mins < b) return true;
        } else {
          // vira a noite: hoje cobre da hora inicial até 23:59
          if (mins >= a) return true;
        }
      }
      return false;
    };
    return check(dow, false) || check((dow + 6) % 7, true);
  }
  // legado: janela única + dias
  const days: number[] | null = agent.work_days || null;
  const inDay = !days || days.length === 0 || days.includes(dow);
  const h = br.getUTCHours();
  const hs = agent.work_hour_start ?? 8, he = agent.work_hour_end ?? 20;
  return inDay && h >= hs && h < he;
}

// ---------- Ferramentas do agente (agenda + funil) ----------
function buildTools(agent: any, hasLead: boolean): any[] {
  const tools: any[] = [];
  if (agent.scheduling_enabled && (agent.scheduling_staff_ids || []).length > 0) {
    tools.push({
      name: "consultar_horarios",
      description: `Consulta horários LIVRES na agenda do closer para uma data. Só horários entre ${agent.schedule_hour_start}h e ${agent.schedule_hour_end}h são oferecidos. Use antes de propor horário.`,
      input_schema: {
        type: "object",
        properties: { data: { type: "string", description: "Data desejada no formato YYYY-MM-DD" } },
        required: ["data"],
      },
    });
    {
      tools.push({
        name: "agendar_reuniao",
        description: "Agenda a reunião na agenda do closer no horário confirmado pelo lead. SÓ use depois que o lead confirmar explicitamente um horário que você ofereceu via consultar_horarios.",
        input_schema: {
          type: "object",
          properties: {
            data_hora: { type: "string", description: "Data e hora confirmadas, formato YYYY-MM-DDTHH:MM (horário de Brasília)" },
            titulo: { type: "string", description: "Título curto da reunião, ex: 'Reunião UNV x Nome do Lead'" },
            email: { type: "string", description: "E-mail do lead, coletado na conversa. OBRIGATÓRIO: peça antes de agendar se ainda não tiver." },
            telefone: { type: "string", description: "Telefone/WhatsApp do lead com DDD, coletado na conversa. OBRIGATÓRIO: peça antes de agendar se ainda não tiver." },
            nome_completo: { type: "string", description: "Nome completo do lead, se ele informou." },
          },
          required: ["data_hora", "titulo"],
        },
      });
    }
  }
  if (agent.can_move_stage && hasLead) {
    tools.push({
      name: "marcar_fora_do_perfil",
      description: "Use quando ficar claro que o lead NÃO é do perfil que atendemos (fora do ICP): outro segmento, sem operação comercial, pessoa física buscando emprego, curioso, concorrente, ou qualquer caso que não faz sentido seguir. Move o negócio para a etapa Fora do ICP e registra o motivo. Não use por falta de orçamento momentâneo ou por 'quero pensar' — isso é objeção, não fora de perfil.",
      input_schema: {
        type: "object",
        properties: { motivo: { type: "string", description: "Em uma frase, por que o lead está fora do perfil" } },
        required: ["motivo"],
      },
    });
    tools.push({
      name: "mover_etapa",
      description: "Move o negócio (lead) para outra etapa do funil dele. Use quando o estágio da conversa mudar (ex: lead qualificado, reunião agendada).",
      input_schema: {
        type: "object",
        properties: { etapa: { type: "string", description: "Nome (ou parte do nome) da etapa de destino" } },
        required: ["etapa"],
      },
    });
  }
  return tools;
}

/** Alerta interno por WhatsApp — instância oficial "fabricionunnes"
 * (mesmo caminho usado pelos outros alertas do sistema). */
async function sendWhatsAppAlert(supabase: any, phone: string, text: string): Promise<boolean> {
  try {
    let { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, api_url, api_key, status, provider_type")
      .eq("instance_name", "fabricionunnes")
      .eq("status", "connected")
      .maybeSingle();
    if (!inst) {
      const { data: fallback } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, api_url, api_key, status, provider_type")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      inst = fallback;
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
      body: JSON.stringify({ number: phone, text }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/** Transcreve áudio do lead (Whisper). O CDN da Meta assina a URL e ela expira,
 * então transcrevemos na hora da resposta e guardamos pra não refazer. */
async function transcribeAudio(url: string): Promise<string | null> {
  try {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key || !url) return null;
    const media = await fetch(url);
    if (!media.ok) {
      console.error("[transcribe] download falhou:", media.status);
      return null;
    }
    const blob = await media.blob();
    if (blob.size > 24 * 1024 * 1024) return null;
    const form = new FormData();
    form.append("file", blob, "audio.mp4");
    form.append("model", "whisper-1");
    form.append("language", "pt");
    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!resp.ok) {
      console.error("[transcribe] whisper falhou:", resp.status, (await resp.text()).slice(0, 200));
      return null;
    }
    const data = await resp.json();
    const text = String(data?.text || "").trim();
    return text || null;
  } catch (e) {
    console.error("[transcribe] erro:", e);
    return null;
  }
}

async function runTool(supabase: any, agent: any, leadId: string | null, name: string, input: any): Promise<string> {
  try {
    // staff alvo da agenda: primeiro closer configurado
    const staffIds: string[] = agent.scheduling_staff_ids || [];

    if (name === "consultar_horarios") {
      const date = String(input?.data || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Erro: data inválida, use YYYY-MM-DD.";
      const results: string[] = [];
      for (const staffId of staffIds.slice(0, 3)) {
        const { data: staff } = await supabase.from("onboarding_staff").select("id, name, user_id").eq("id", staffId).maybeSingle();
        if (!staff?.user_id) { results.push(`${staff?.name || staffId}: sem agenda conectada`); continue; }
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar?action=freebusy`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
          body: JSON.stringify({ target_user_id: staff.user_id, date, duration_minutes: agent.meeting_duration_minutes || 60 }),
        });
        const fb = await resp.json();
        if (!resp.ok || fb.error) { results.push(`${staff.name}: agenda indisponível (${fb.error || resp.status})`); continue; }
        // Filtra à janela do agente
        const hs = agent.schedule_hour_start ?? 8, he = agent.schedule_hour_end ?? 19;
        const slots = (fb.availableSlots || []).filter((s: string) => {
          const h = parseInt(s.split(":")[0], 10);
          return h >= hs && h < he;
        });
        results.push(`${staff.name} (${date}): ${slots.length ? slots.join(", ") : "nenhum horário livre nessa janela"}`);
      }
      const out = results.join("\n") || "Nenhum closer configurado.";
      return out + "\n\nIMPORTANTE: ofereça APENAS horários desta lista, exatamente como estão. Se o lead já escolheu um horário que está nesta lista, NÃO ofereça de novo: chame agendar_reuniao AGORA com esse horário.";
    }

    if (name === "agendar_reuniao") {
      // TRAVA DE DUPLICIDADE: duas execuções quase simultâneas (o lead manda duas
      // mensagens em sequência) chegavam aqui juntas — a primeira agendava e a
      // segunda batia no conflito da agenda e dizia "esse horário já foi
      // preenchido", desmarcando na cara do cliente uma reunião recém-confirmada.
      if (leadId) {
        const { data: jaTem } = await supabase.from("crm_activities")
          .select("id, scheduled_at, created_at")
          .eq("lead_id", leadId).eq("type", "meeting")
          .not("status", "in", "(cancelled,canceled,no_show)")
          .gte("scheduled_at", new Date().toISOString())
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (jaTem && Date.now() - new Date(jaTem.created_at).getTime() < 10 * 60 * 1000) {
          const q = new Date(jaTem.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          return `Este lead JÁ TEM reunião agendada para ${q} (marcada há instantes). NÃO agende de novo, NÃO ofereça outros horários e NÃO diga que o horário ficou indisponível — apenas siga a conversa normalmente.`;
        }
      }
      const dt = String(input?.data_hora || "");
      const title = String(input?.titulo || "Reunião");
      const m = dt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
      if (!m) return "Erro: data_hora inválida, use YYYY-MM-DDTHH:MM.";
      const hour = parseInt(m[2], 10);
      const hs = agent.schedule_hour_start ?? 8, he = agent.schedule_hour_end ?? 19;
      if (hour < hs || hour >= he) return `Erro: fora da janela permitida (${hs}h às ${he}h). Ofereça outro horário.`;
      const staffId = staffIds[0];
      const { data: staff } = await supabase.from("onboarding_staff").select("id, name, user_id").eq("id", staffId).maybeSingle();
      if (!staff?.user_id) return "Erro: closer sem agenda conectada.";
      const dur = agent.meeting_duration_minutes || 60;
      // Conflito: confirma que o horário AINDA está livre antes de criar o evento.
      // Se ocupou, devolve os horários reais pra IA reoferecer com base na agenda.
      try {
        const fbR = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar?action=freebusy`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
          body: JSON.stringify({ target_user_id: staff.user_id, date: m[1], duration_minutes: dur }),
        });
        const fbD = await fbR.json();
        if (fbR.ok && Array.isArray(fbD.availableSlots)) {
          const want = `${m[2]}:${m[3]}`;
          const okSlots = fbD.availableSlots.filter((sl: string) => {
            const hh = parseInt(sl.split(":")[0], 10);
            return hh >= hs && hh < he;
          });
          if (!okSlots.includes(want)) {
            return `Erro: o horário ${want} não está mais disponível em ${m[1]}. Horários livres: ${okSlots.join(", ") || "nenhum"}. Ofereça esses ao lead.`;
          }
        }
      } catch { /* se o freebusy falhar, segue e tenta criar */ }
      const startISO = `${m[1]}T${m[2]}:${m[3]}:00-03:00`;
      const endDate = new Date(new Date(startISO).getTime() + dur * 60000);
      // fim no mesmo fuso -03:00
      const endISO = new Date(endDate.getTime() - 3 * 3600000).toISOString().slice(0, 19) + "-03:00";
      // Descrição do evento: mesmo padrão do agendamento manual do CRM (link do lead)
      let description = "Agendado pelo agente de IA do CRM Comercial.";
      let leadRow: any = null;
      if (leadId) {
        const { data: lr } = await supabase.from("crm_leads")
          .select("id, name, phone, email, company, pipeline_id, sdr_staff_id, owner_staff_id, scheduled_by_staff_id")
          .eq("id", leadId).maybeSingle();
        leadRow = lr;
        if (lr) {
          description = [
            `Lead: ${lr.name}${lr.company ? ` (${lr.company})` : ""}${lr.phone ? ` · ${lr.phone}` : ""}`,
            "Agendado pelo agente de IA do CRM Comercial.",
            `📋 Link do lead no CRM: https://unvholdings.com.br/#/crm/leads/${lr.id}`,
          ].join("\n\n");
        }
      }
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar?action=create-event`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, startDateTime: startISO, endDateTime: endISO, target_user_id: staff.user_id }),
      });
      const ev = await resp.json();
      if (!resp.ok || ev.error) return `Erro ao agendar: ${ev.error || resp.status}`;
      // registra a reunião como atividade do lead
      if (leadId) {
        await supabase.from("crm_activities").insert({
          lead_id: leadId, type: "meeting", title,
          scheduled_at: startISO, status: "pending",
          responsible_staff_id: staff.id,
          meeting_link: ev.event?.meetingLink || null,
          google_calendar_event_id: ev.event?.id || null,
          google_calendar_user_id: staff.user_id,
        });
        // Marca o agendamento no funil: move pra etapa 'Agendado' se o funil tiver uma
        if (leadRow?.pipeline_id) {
          const { data: stages } = await supabase.from("crm_stages")
            .select("id, name").eq("pipeline_id", leadRow.pipeline_id);
          const agendado = (stages || []).find((st: any) => st.name.toLowerCase().includes("agendad"));
          if (agendado) {
            await supabase.from("crm_leads")
              .update({ stage_id: agendado.id, stage_entered_at: new Date().toISOString() })
              .eq("id", leadId);
          }
        }
      }
      // Contato coletado na conversa vai pro cadastro do lead (não sobrescreve o que já existe)
      if (leadId) {
        const contactUpd: Record<string, string> = {};
        const email = String(input?.email || "").trim();
        const phoneIn = String(input?.telefone || "").replace(/\D/g, "");
        const fullName = String(input?.nome_completo || "").trim();
        if (email && /.+@.+\..+/.test(email) && !leadRow?.email) contactUpd.email = email;
        if (phoneIn.length >= 10 && !leadRow?.phone) contactUpd.phone = phoneIn;
        // "não informado", só dígitos, @usuario ou vazio = lead sem nome de verdade
        const currentName = String(leadRow?.name || "").trim();
        const nameIsPlaceholder =
          !currentName ||
          /^(n[aã]o informado|sem nome|desconhecid[oa]|lead|contato)$/i.test(currentName) ||
          /^@?[\d\s()+-]+$/.test(currentName) ||
          currentName.startsWith("@");
        if (fullName && (nameIsPlaceholder || fullName.length > currentName.length)) {
          contactUpd.name = fullName;
        }
        if (Object.keys(contactUpd).length > 0) {
          await supabase.from("crm_leads").update(contactUpd).eq("id", leadId);
        }
      }

      // Avisa a SDR/dona do lead que a IA agendou (WhatsApp pela instância fabricionunnes)
      try {
        if (leadRow) {
          const notifyIds = [leadRow.sdr_staff_id, leadRow.owner_staff_id, leadRow.scheduled_by_staff_id]
            .filter(Boolean);
          const { data: notifyStaff } = notifyIds.length
            ? await supabase.from("onboarding_staff").select("id, name, phone").in("id", notifyIds)
            : { data: [] as any[] };
          const alvo = (notifyStaff || []).find((st: any) => (st.phone || "").replace(/\D/g, "").length >= 10);
          // sem telefone cadastrado no responsável, o aviso vai pro Fabrício
          // (melhor avisar alguém do que perder o agendamento no silêncio)
          const FALLBACK = "5531989840003";
          {
            const digits = alvo ? String(alvo.phone).replace(/\D/g, "") : "";
            const num = digits ? (digits.startsWith("55") ? digits : `55${digits}`) : FALLBACK;
            const quando = `${m[1].split("-").reverse().join("/")} às ${m[2]}:${m[3]}`;
            const texto = [
              "Agendamento feito pelo agente de IA",
              "",
              `Lead: ${leadRow.name}${leadRow.company ? ` (${leadRow.company})` : ""}`,
              `Quando: ${quando} com ${staff.name}`,
              leadRow.phone ? `Telefone: ${leadRow.phone}` : null,
              `Link no CRM: https://unvholdings.com.br/#/crm/leads/${leadRow.id}`,
            ].filter(Boolean).join("\n");
            await sendWhatsAppAlert(supabase, num, texto);
          }
        }
      } catch (e) {
        console.error("[crm-agent-respond] falha ao notificar SDR:", e);
      }

      const link = ev.event?.meetingLink ? ` Link da reunião: ${ev.event.meetingLink}` : "";
      return `Reunião agendada com ${staff.name} em ${m[1]} às ${m[2]}:${m[3]}.${link}`;
    }

    if (name === "marcar_fora_do_perfil") {
      if (!leadId) return "Erro: conversa sem negócio vinculado.";
      const motivo = String(input?.motivo || "").trim() || "fora do perfil identificado pelo agente";
      const { data: lead } = await supabase.from("crm_leads").select("id, pipeline_id, notes, sdr_staff_id, owner_staff_id, closer_staff_id").eq("id", leadId).maybeSingle();
      if (!lead?.pipeline_id) return "Erro: lead sem funil.";
      const { data: stages } = await supabase.from("crm_stages").select("id, name").eq("pipeline_id", lead.pipeline_id);
      // procura a etapa de fora do perfil pelo nome (Fora do ICP, Fora de perfil...)
      const alvo = (stages || []).find((st: any) => /fora do icp|fora de icp|fora do perfil|fora de perfil|sem fit/i.test(st.name));
      // Sempre registra a marcação (é ela que os indicadores leem). Mover de
      // etapa só acontece se o funil tiver uma etapa de fora do perfil — sem
      // etapa, não inventamos destino.
      const patch: Record<string, unknown> = {
        notes: [lead.notes, `[Agente IA] Fora do perfil: ${motivo}`].filter(Boolean).join("\n"),
      };
      if (alvo) { patch.stage_id = alvo.id; patch.stage_entered_at = new Date().toISOString(); }
      await supabase.from("crm_leads").update(patch).eq("id", leadId);
      // crm_meeting_events exige um responsável creditado: usa SDR > dono > closer.
      // Sem ninguém atribuído, a marcação fica só na etapa/nota (não inventa crédito).
      const creditado = lead.sdr_staff_id || lead.owner_staff_id || lead.closer_staff_id || null;
      if (creditado) {
        const { error: evErr } = await supabase.from("crm_meeting_events").insert({
          lead_id: leadId, pipeline_id: lead.pipeline_id, stage_id: alvo?.id || null,
          credited_staff_id: creditado, event_type: "out_of_icp", event_date: new Date().toISOString(),
        });
        if (evErr) console.error("marcar_fora_do_perfil: evento não registrado", evErr.message);
      }
      return alvo
        ? `Negócio movido para "${alvo.name}" e marcado como fora do perfil. Encerre a conversa com educação, sem prometer retorno.`
        : `Lead marcado como fora do perfil (este funil não tem etapa "Fora do ICP", então ele ficou onde está). Encerre a conversa com educação.`;
    }

    if (name === "mover_etapa") {
      if (!leadId) return "Erro: conversa sem negócio vinculado.";
      const term = String(input?.etapa || "").trim().toLowerCase();
      if (!term) return "Erro: informe o nome da etapa.";
      const { data: lead } = await supabase.from("crm_leads").select("id, pipeline_id").eq("id", leadId).maybeSingle();
      if (!lead?.pipeline_id) return "Erro: lead sem funil.";
      const { data: stages } = await supabase.from("crm_stages").select("id, name").eq("pipeline_id", lead.pipeline_id);
      const target = (stages || []).find((s: any) => s.name.toLowerCase().includes(term));
      if (!target) return `Erro: etapa "${term}" não encontrada. Etapas do funil: ${(stages || []).map((s: any) => s.name).join(", ")}`;
      await supabase.from("crm_leads").update({ stage_id: target.id, stage_entered_at: new Date().toISOString() }).eq("id", leadId);
      return `Negócio movido para a etapa "${target.name}".`;
    }

    return `Ferramenta desconhecida: ${name}`;
  } catch (e) {
    return `Erro na ferramenta ${name}: ${String((e as Error).message || e)}`;
  }
}


/** medidor de tokens: grava o usage de cada chamada (fire-and-forget) */
function logUsoIA(fn: string, model: string, usage: any, meta?: Record<string, unknown>) {
  try {
    fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/ai_usage_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      },
      body: JSON.stringify({
        fn, model,
        input_tokens: usage?.input_tokens ?? 0,
        output_tokens: usage?.output_tokens ?? 0,
        cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
        cache_write_tokens: usage?.cache_creation_input_tokens ?? 0,
        meta: meta ?? null,
      }),
    }).catch(() => {});
  } catch { /* medidor nunca derruba a função */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const body0 = await req.json();
    const { channel, conversation_id, dry_run } = body0;

    // Debug/admin: executa uma ferramenta isolada (sem conversa) pra validar agenda
    if (body0.action === "test_tool") {
      const { data: agent } = await supabase.from("crm_ai_agents").select("*").eq("id", body0.agent_id).maybeSingle();
      if (!agent) return j({ ok: false, error: "agente não encontrado" }, 400);
      const result = await runTool(supabase, agent, body0.lead_id || null, body0.tool, body0.tool_input || {});
      return j({ ok: true, tool: body0.tool, result });
    }

    // ---------- Gatilho por ETAPA: ativa o agente e manda a saudação ao lead entrar na etapa ----------
    if (body0.action === "stage_trigger") {
      const { agent_id, lead_id } = body0;
      const { data: ag } = await supabase.from("crm_ai_agents").select("*").eq("id", agent_id).maybeSingle();
      if (!ag || !ag.is_active) return j({ ok: true, skip: "agente inativo" });
      const [{ data: waConvs }, { data: igConvs }, { data: agentChannels }] = await Promise.all([
        supabase.from("crm_whatsapp_conversations").select("id, instance_id, contact:crm_whatsapp_contacts(phone)").eq("lead_id", lead_id),
        supabase.from("instagram_conversations").select("id").eq("lead_id", lead_id),
        supabase.from("crm_ai_agent_channels").select("channel, instance_id").eq("agent_id", agent_id),
      ]);
      // O gatilho por etapa só ativa o agente nos CANAIS em que ele está
      // configurado (crm_ai_agent_channels). Sem canal configurado, não ativa
      // nada — fail-closed. Incidente 2026-08-06: agente de Instagram entrou
      // no WhatsApp de lead real no meio da negociação da SDR.
      const binds = agentChannels || [];
      if (!binds.length) return j({ ok: true, skip: "agente sem canal configurado — gatilho por etapa não ativa" });
      const allowsChannel = (channel: string, instanceId?: string | null) =>
        binds.some((b: any) => b.channel === channel && (!b.instance_id || !instanceId || b.instance_id === instanceId));
      const targets: any[] = [
        ...(waConvs || []).filter((c: any) => allowsChannel("whatsapp", c.instance_id)).map((c: any) => ({ channel: "whatsapp", conv: c })),
        ...(igConvs || []).filter(() => allowsChannel("instagram")).map((c: any) => ({ channel: "instagram", conv: c })),
      ];
      let greeted = 0;
      for (const t of targets) {
        const { data: prev } = await supabase.from("crm_keyword_trigger_logs")
          .select("id").eq("agent_id", agent_id).eq("conversation_id", t.conv.id).eq("source", "stage").limit(1).maybeSingle();
        if (prev) continue;
        await supabase.from("crm_ai_agent_conversation_overrides").upsert({
          agent_id, conversation_id: t.conv.id, channel: t.channel, enabled: true, reply_mode: "auto",
        }, { onConflict: "conversation_id,channel" });
        const greeting = String(ag.greeting || "").trim();
        if (greeting && !body0.dry_run) {
          if (t.channel === "instagram") {
            await supabase.functions.invoke("instagram-send", { body: { conversationId: t.conv.id, message: greeting, staffId: null } });
          } else {
            const ph = String(t.conv.contact?.phone || "").replace(/\D/g, "");
            const sent = await sendWhatsAppText(supabase, t.conv.instance_id, ph, greeting);
            if (sent.ok) await supabase.from("crm_whatsapp_conversations").update({ last_message: greeting.substring(0, 255), last_message_at: new Date().toISOString() }).eq("id", t.conv.id);
          }
        }
        await supabase.from("crm_keyword_trigger_logs").insert({
          agent_id, conversation_id: t.conv.id, channel: t.channel, source: "stage", matched_keyword: greeting ? "(saudação)" : "(ativado)",
        });
        greeted++;
      }
      return j({ ok: true, greeted });
    }

    // ---------- Follow-up automático (cron): reativa leads que pararam de responder ----------
    if (body0.action === "followups") {
      const results: string[] = [];
      const { data: agents } = await supabase.from("crm_ai_agents")
        .select("*").eq("is_active", true).eq("followup_enabled", true);
      for (const agent of (agents || [])) {
        // horário de atendimento vale pro follow-up também
        if (!agentScheduleActive(agent)) continue;
        const afterMin = Math.max(15, agent.followup_after_minutes || 60);
        const maxAtt = Math.max(1, agent.followup_max_attempts || 2);
        const { data: bindings } = await supabase.from("crm_ai_agent_channels")
          .select("channel, instance_id").eq("agent_id", agent.id);
        for (const b of (bindings || [])) {
          const isBIG = b.channel === "instagram";
          const convTable = isBIG ? "instagram_conversations" : "crm_whatsapp_conversations";
          const msgTable = isBIG ? "instagram_messages" : "crm_whatsapp_messages";
          const tsCol = isBIG ? "timestamp" : "created_at";
          const { data: convs } = await supabase.from(convTable)
            .select(isBIG
              ? "id, instance_id, lead_id, contact:instagram_contacts(name, username)"
              : "id, instance_id, lead_id, contact:crm_whatsapp_contacts(name, phone)")
            .eq("instance_id", b.instance_id)
            .lt("last_message_at", new Date(Date.now() - afterMin * 60000).toISOString())
            .gt("last_message_at", new Date(Date.now() - 7 * 86400000).toISOString())
            .order("last_message_at", { ascending: false }).limit(30);
          for (const cv of (convs || [])) {
            if (results.length >= 10) break; // no máx 10 follow-ups por rodada
            // WhatsApp: nunca em grupo
            if (!isBIG) {
              const ph = String((cv as any).contact?.phone || "");
              if (ph.includes("@") || ph.includes("-") || ph.replace(/\D/g, "").length > 15) continue;
            }
            // agente desligado nesta conversa?
            const { data: ov } = await supabase.from("crm_ai_agent_conversation_overrides")
              .select("enabled, reply_mode").eq("conversation_id", cv.id).eq("channel", b.channel).maybeSingle();
            if (ov && ov.enabled === false) continue;
            // follow-up só em modo auto (mesma regra de allowlist por funil)
            const fmode = await resolveAgentMode(supabase, agent, cv.lead_id, ov);
            if (fmode !== "auto") continue;
            // Já agendou? Lead com reunião FUTURA não pode receber follow-up de
            // reativação (senão o agente pede pra agendar de novo, como já ocorreu).
            if (cv.lead_id) {
              const { data: futureMtgs } = await supabase.from("crm_activities")
                .select("status").eq("lead_id", cv.lead_id).eq("type", "meeting")
                .gte("scheduled_at", new Date().toISOString()).limit(5);
              const hasFuture = (futureMtgs || []).some((m: any) =>
                !["cancelled", "canceled", "no_show"].includes(String(m.status || "").toLowerCase()));
              if (hasFuture) continue;
            }
            // histórico: precisa terminar em outbound (lead sumiu) e ter tido inbound antes
            const { data: hist } = await supabase.from(msgTable)
              .select(`direction, content, ${tsCol}`).eq("conversation_id", cv.id)
              .order(tsCol, { ascending: true }).limit(40);
            const hm = (hist || []).filter((m: any) => (m.content || "").trim().length > 0);
            if (hm.length < 2) continue;
            if (hm[hm.length - 1].direction !== "outbound") continue;
            let trailing = 0;
            for (let i = hm.length - 1; i >= 0 && hm[i].direction === "outbound"; i--) trailing++;
            if (trailing >= hm.length) continue; // nunca teve resposta do lead
            if (trailing - 1 >= maxAtt) continue; // já esgotou as tentativas
            // monta prompt de reativação
            const leadNm = (cv as any).contact?.name || (cv as any).contact?.username || "o lead";
            const histTxt = hm.slice(-14).map((m: any) => `${m.direction === "inbound" ? leadNm : "Você"}: ${m.content}`).join("\n");
            const fuSystem = [
              agent.instructions || "Você é um atendente comercial.",
              agent.tone ? `\nTOM DE VOZ: ${agent.tone}` : "",
              `\n\nO lead parou de responder. Escreva UMA mensagem CURTA de follow-up (1-2 frases) retomando a conversa de forma leve e humana, sem pressão e sem repetir perguntas já respondidas. Referencie o assunto em aberto. Não use markdown. Nunca revele que é uma IA.`,
            ].join("");
            const aiR = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
              body: JSON.stringify({ model: agent.model || "claude-sonnet-5", system: fuSystem, max_tokens: 300,
                messages: [{ role: "user", content: `Histórico:\n${histTxt}\n\nEscreva o follow-up agora.` }] }),
            });
            if (!aiR.ok) continue;
            const aiD = await aiR.json();
            const fuTexts = (Array.isArray(aiD?.content) ? aiD.content : []).filter((x: any) => x?.type === "text").map((x: any) => String(x.text));
            const fuReply = [...new Set(fuTexts)].join("").trim();
            if (!fuReply) continue;
            if (body0.dry_run) { results.push(`[dry] ${b.channel}/${cv.id}: ${fuReply.slice(0, 80)}`); continue; }
            if (isBIG) {
              const { error: se } = await supabase.functions.invoke("instagram-send", {
                body: { conversationId: cv.id, message: fuReply, staffId: null } });
              if (se) continue;
            } else {
              const ph = String((cv as any).contact?.phone || "").replace(/\D/g, "");
              const sent = await sendWhatsAppText(supabase, (cv as any).instance_id, ph, fuReply);
              if (!sent.ok) continue;
              await supabase.from("crm_whatsapp_conversations").update({
                last_message: fuReply.substring(0, 255), last_message_at: new Date().toISOString() }).eq("id", cv.id);
            }
            results.push(`${b.channel}/${cv.id}: enviado`);
          }
        }
      }
      return j({ ok: true, followups: results.length, detail: results });
    }

    if (channel !== "instagram" && channel !== "whatsapp") return j({ ok: false, skip: "canal não suportado" });
    if (!conversation_id) return j({ ok: false, error: "conversation_id obrigatório" }, 400);
    const isIG = channel === "instagram";

    // 1) Conversa + contato + lead
    let conv: any = null;
    if (isIG) {
      const { data } = await supabase.from("instagram_conversations")
        .select("id, instance_id, contact_id, lead_id, contact:instagram_contacts(name, username)")
        .eq("id", conversation_id).maybeSingle();
      conv = data;
    } else {
      const { data } = await supabase.from("crm_whatsapp_conversations")
        .select("id, instance_id, contact_id, lead_id, contact:crm_whatsapp_contacts(name, phone)")
        .eq("id", conversation_id).maybeSingle();
      conv = data;
    }
    if (!conv) return j({ ok: false, error: "conversa não encontrada" });
    if (!isIG && !conv.instance_id) return j({ ok: true, skip: "conversa sem instância Evolution" });

    // WhatsApp: nunca responder em GRUPO/newsletter — agente é só pra conversa individual
    if (!isIG) {
      const cphone = String(conv.contact?.phone || "");
      if (cphone.includes("@g.us") || cphone.includes("@newsletter") || cphone.includes("-") || cphone.replace(/\D/g, "").length > 15) {
        return j({ ok: true, skip: "conversa de grupo/newsletter — agente não atua" });
      }
    }

    // 1.5) GATILHO POR PALAVRA-CHAVE (estilo ManyChat). Se a última mensagem do
    // lead bate uma regra ativa, ligamos o agente qualificador da regra NESTA
    // conversa (via override) — mesmo que o funil estivesse "off" e mesmo que o
    // agente não esteja vinculado ao canal. Idempotente: só liga uma vez por regra.
    let forcedAgent: any = null;
    try {
      const msgTable = isIG ? "instagram_messages" : "crm_whatsapp_messages";
      const tsCol = isIG ? "timestamp" : "created_at";
      const { data: lastIn } = await supabase.from(msgTable)
        .select(`content, direction, ${tsCol}`)
        .eq("conversation_id", conversation_id).eq("direction", "inbound")
        .order(tsCol, { ascending: false }).limit(1).maybeSingle();
      const text = String((lastIn as any)?.content || "").toLowerCase().trim();
      const matchKw = (kw: string, mt: string) =>
        mt === "exact" ? text === kw : mt === "starts" ? text.startsWith(kw) : text.includes(kw);
      if (text) {
        // (a) PALAVRA-CHAVE NO PRÓPRIO AGENTE (jeito simples: você edita o agente e
        // coloca as palavras que o ativam). Vale pra qualquer agente ativo com
        // trigger_keywords, mesmo sem estar vinculado ao canal.
        const { data: kwAgents } = await supabase.from("crm_ai_agents")
          .select("*").eq("is_active", true).not("trigger_keywords", "is", null);
        for (const ag of (kwAgents || [])) {
          const kws: string[] = (ag.trigger_keywords || []).map((k: string) => k.toLowerCase().trim()).filter(Boolean);
          if (kws.length === 0) continue;
          if (!(ag.trigger_channels || ["whatsapp", "instagram"]).includes(channel)) continue;
          const hit = kws.find((kw) => matchKw(kw, ag.trigger_match_type || "contains"));
          if (!hit) continue;
          const { data: prev } = await supabase.from("crm_keyword_trigger_logs")
            .select("id").eq("agent_id", ag.id).eq("conversation_id", conversation_id).eq("source", "agent_kw").limit(1).maybeSingle();
          if (prev) continue;
          await supabase.from("crm_ai_agent_conversation_overrides").upsert({
            agent_id: ag.id, conversation_id, channel, enabled: true, reply_mode: "auto",
          }, { onConflict: "conversation_id,channel" });
          await supabase.from("crm_keyword_trigger_logs").insert({
            agent_id: ag.id, conversation_id, channel, source: "agent_kw", matched_keyword: hit,
          });
          forcedAgent = ag;
          break;
        }
      }
      if (text && !forcedAgent) {
        const { data: rules } = await supabase.from("crm_keyword_triggers")
          .select("*").eq("is_active", true).eq("listen_dm", true)
          .order("priority", { ascending: false });
        for (const rule of (rules || [])) {
          if (!(rule.channels || []).includes(channel)) continue;
          if (rule.pipeline_id && conv.lead_id) {
            // se a regra é de um funil específico, respeita o funil do lead
            const { data: ld } = await supabase.from("crm_leads").select("pipeline_id").eq("id", conv.lead_id).maybeSingle();
            if (ld && ld.pipeline_id !== rule.pipeline_id) continue;
          }
          const kws: string[] = (rule.keywords || []).map((k: string) => k.toLowerCase().trim()).filter(Boolean);
          const hit = kws.find((kw) =>
            rule.match_type === "exact" ? text === kw
            : rule.match_type === "starts" ? text.startsWith(kw)
            : text.includes(kw));
          if (!hit) continue;
          // já disparou esta regra nesta conversa? não repete
          const { data: prev } = await supabase.from("crm_keyword_trigger_logs")
            .select("id").eq("trigger_id", rule.id).eq("conversation_id", conversation_id).limit(1).maybeSingle();
          if (prev) continue;
          const { data: ruleAgent } = await supabase.from("crm_ai_agents").select("*").eq("id", rule.agent_id).maybeSingle();
          if (!ruleAgent || !ruleAgent.is_active) continue;
          // liga o agente da regra nesta conversa (auto) e registra
          await supabase.from("crm_ai_agent_conversation_overrides").upsert({
            agent_id: rule.agent_id, conversation_id, channel, enabled: true, reply_mode: "auto",
          }, { onConflict: "conversation_id,channel" });
          await supabase.from("crm_keyword_trigger_logs").insert({
            trigger_id: rule.id, agent_id: rule.agent_id, conversation_id, channel,
            source: "dm", matched_keyword: hit,
          });
          forcedAgent = ruleAgent;
          break;
        }
      }
    } catch (e) { console.error("keyword match error", e); }

    // 2) Agente: o forçado pela palavra-chave vence; senão o vinculado à instância/canal
    let agent: any = forcedAgent;
    // Override da conversa (interruptor + agente fixado por palavra-chave/manual)
    const { data: override } = await supabase
      .from("crm_ai_agent_conversation_overrides")
      .select("enabled, reply_mode, agent_id").eq("conversation_id", conversation_id).eq("channel", channel).maybeSingle();
    if (override && override.enabled === false) return j({ ok: true, skip: "agente desligado nesta conversa" });

    // Agente fixado no override (foi uma palavra-chave que ligou este agente aqui):
    // mantém o MESMO agente qualificador ao longo da conversa, mesmo sem vínculo de canal.
    if (!agent && override?.agent_id && override.enabled) {
      const { data: ovAgent } = await supabase.from("crm_ai_agents").select("*").eq("id", override.agent_id).maybeSingle();
      if (ovAgent && ovAgent.is_active) agent = ovAgent;
    }
    if (!agent) {
      const { data: chRows } = await supabase
        .from("crm_ai_agent_channels")
        .select("agent_id, agent:crm_ai_agents(*)")
        .eq("channel", channel).eq("instance_id", conv.instance_id);
      const agents = (chRows || []).map((r: any) => r.agent).filter((a: any) => a && a.is_active);
      if (agents.length === 0) return j({ ok: true, skip: "nenhum agente ativo nesta instância" });
      agents.sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1));
      agent = agents[0];
    }

    // 3) Modo: override da conversa > funil do lead (allowlist) > padrão do agente
    const mode = await resolveAgentMode(supabase, agent, conv.lead_id, override);
    if (mode === "off") return j({ ok: true, skip: "modo desligado para este funil" });

    // Horário de atendimento do agente (Brasília). Fora da janela → não responde.
    if (!dry_run && !agentScheduleActive(agent)) {
      return j({ ok: true, skip: "fora do horário de atendimento" });
    }

    // Tempo de resposta: adia o processamento e responde só à ÚLTIMA mensagem da
    // rajada (cada mensagem dispara um run; após o sleep, só o run da mensagem
    // mais recente segue — os outros veem inbound mais novo e desistem).
    const delaySec = Number(agent.response_delay_seconds || 0);
    const triggerTs: string | null = body0.message_ts || null;
    if (delaySec > 0 && !dry_run) {
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil?.((async () => {
        await new Promise((r) => setTimeout(r, Math.min(delaySec, 300) * 1000));
        try {
          // re-checa o estado da conversa depois da espera
          const msgTable = isIG ? "instagram_messages" : "crm_whatsapp_messages";
          const tsCol = isIG ? "timestamp" : "created_at";
          const { data: latest } = await supabase.from(msgTable)
            .select(`direction, ${tsCol}`)
            .eq("conversation_id", conversation_id)
            .order(tsCol, { ascending: false }).limit(1).maybeSingle();
          if (!latest || latest.direction !== "inbound") return; // já respondida
          if (triggerTs && new Date((latest as any)[tsCol]).getTime() > new Date(triggerTs).getTime() + 3000) {
            return; // chegou mensagem mais nova: o run dela responde
          }
          const result = await processConversation();
          console.log("deferred result:", JSON.stringify(result).slice(0, 300));
          if ((result as any)?.error) {
            await supabase.from("crm_ai_suggested_replies").insert({
              channel: "debug", conversation_id, content: "deferred result erro: " + JSON.stringify(result).slice(0, 400), status: "debug",
            });
          }
        } catch (e) {
          console.error("deferred error", e);
          await supabase.from("crm_ai_suggested_replies").insert({
            channel: "debug", conversation_id, content: "deferred EXCECAO: " + String((e as Error)?.stack || e).slice(0, 500), status: "debug",
          }).then(() => {}, () => {});
        }
      })());
      return j({ ok: true, deferred: true, delay_seconds: delaySec, agent: agent.name });
    }

    const inline = await processConversation();
    return j(inline);

    // ---------------- processamento (histórico → IA → envio/sugestão) ----------------
    async function processConversation(): Promise<Record<string, unknown>> {
    // 4) Histórico
    let msgs: { direction: string; content: string; ts: string }[] = [];
    let rawHistory: any[] = [];
    if (isIG) {
      const { data: history } = await supabase.from("instagram_messages")
        .select("id, direction, content, timestamp, message_type, media_url, transcription")
        .eq("conversation_id", conversation_id)
        .order("timestamp", { ascending: true }).limit(40);
      rawHistory = (history || []).map((m: any) => ({ ...m, ts: m.timestamp }));
    } else {
      const { data: history } = await supabase.from("crm_whatsapp_messages")
        .select("id, direction, content, created_at, type, media_url, transcription")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true }).limit(40);
      rawHistory = (history || []).map((m: any) => ({ ...m, message_type: m.type, ts: m.created_at }));
    }
    // Áudio: o lead manda voz e a mensagem chega como "[audio]". Transcrevemos
    // (até 4 dos mais recentes) pra o agente responder o que foi dito, em texto.
    const isAudio = (m: any) =>
      String(m.message_type || "").toLowerCase().includes("audio") ||
      String(m.message_type || "").toLowerCase().includes("ptt") ||
      /^\[(audio|áudio|voice)\]$/i.test(String(m.content || "").trim());

    const audiosToDo = rawHistory
      .filter((m) => isAudio(m) && !m.transcription && m.media_url)
      .slice(-4);

    for (const m of audiosToDo) {
      const text = await transcribeAudio(m.media_url);
      if (text) {
        m.transcription = text;
        const table = isIG ? "instagram_messages" : "crm_whatsapp_messages";
        await supabase.from(table).update({ transcription: text }).eq("id", m.id);
      }
    }

    msgs = rawHistory.map((m: any) => {
      let content = m.content || "";
      if (isAudio(m)) {
        content = m.transcription
          ? `(áudio do lead, transcrito) ${m.transcription}`
          : "(o lead mandou um áudio que não consegui transcrever)";
      }
      return { direction: m.direction, content, ts: m.ts };
    });

    msgs = msgs.filter((m) => m.content.trim().length > 0);
    // Higieniza histórico já poluído: (a) colapsa "texto+texto" dentro da mesma
    // mensagem; (b) remove cópia consecutiva idêntica (eco gravado em dobro).
    const unhalve = (t: string) => {
      const s2 = t.trim();
      if (s2.length >= 20 && s2.length % 2 === 0) {
        const half = s2.length / 2;
        const a = s2.slice(0, half).trim(), b = s2.slice(half).trim();
        if (a === b) return a;
      }
      const nl = s2.indexOf("\n" + s2.slice(0, 40));
      if (nl > 0 && s2.slice(nl + 1).trim() === s2.slice(0, nl).trim()) return s2.slice(0, nl).trim();
      return s2;
    };
    msgs = msgs.map((m) => ({ ...m, content: unhalve(m.content) }));
    msgs = msgs.filter((m, i) => !(i > 0 && msgs[i - 1].direction === m.direction && msgs[i - 1].content === m.content));
    if (msgs.length === 0) return { ok: true, skip: "sem conteúdo textual" };
    if (msgs[msgs.length - 1].direction !== "inbound") return { ok: true, skip: "última mensagem não é do lead" };

    // Anti-rajada: agente respondeu há <12s → não dispara de novo
    const lastOut = [...msgs].reverse().find((m) => m.direction === "outbound");
    if (lastOut && Date.now() - new Date(lastOut.ts).getTime() < 12000) {
      return { ok: true, skip: "resposta recente do agente (debounce)" };
    }

    // 5) Guardrails
    const outboundCount = msgs.filter((m) => m.direction === "outbound").length;
    if (agent.max_messages && outboundCount >= agent.max_messages) return { ok: true, skip: "limite de mensagens atingido" };
    const lastInbound = msgs[msgs.length - 1].content.toLowerCase();
    const handoff = (agent.handoff_keywords || []).some((k: string) => k && lastInbound.includes(k.toLowerCase()));
    if (handoff) return { ok: true, skip: "handoff acionado por palavra-chave" };

    // 6) Base de conhecimento
    const { data: kn } = await supabase.from("crm_ai_agent_knowledge")
      .select("title, content").eq("agent_id", agent.id).eq("status", "ready");
    let knowledge = "";
    for (const k of (kn || [])) {
      if (!k.content) continue;
      knowledge += `\n\n### ${k.title || "Fonte"}\n${k.content}`;
      if (knowledge.length > 18000) break;
    }
    if (knowledge.length > 18000) knowledge = knowledge.slice(0, 18000);

    const leadName = conv.contact?.name || conv.contact?.username || conv.contact?.phone || "o lead";
    const nowBR = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 16).replace("T", " ");

    // Lead confirmou um horário? ("pode ser as 11", "as 10", "11h", "10:30"...)
    // Vira instrução explícita — o modelo tende a ancorar no histórico e reofertar.
    let confirmedTimeHint = "";
    {
      const lastIn = msgs[msgs.length - 1].content.toLowerCase().trim();
      let hh: string | null = null;
      let mm = "00";
      // negação com horário ("não consigo às 14", "não dá amanhã") não é confirmação
      const isNegative = /\b(n[aã]o|nao|nunca|imposs[ií]vel|outro dia|outro hor[aá]rio|mais tarde|remarcar)\b/.test(lastIn);

      // 1) resposta curta que é SÓ o horário: "14", "14h", "14:00", "as 14"
      //    (lead escolhendo da lista que o agente ofereceu — era o caso que escapava)
      const bare = lastIn.match(/^(?:as|às|pode ser|fechado|bora|vamos|sim|ok|beleza)?\s*(\d{1,2})(?:[:h]?(\d{2}))?\s*(?:h|hs|horas?)?[.!]?$/);
      if (bare) {
        const n = parseInt(bare[1], 10);
        if (n >= 0 && n <= 23) {
          hh = String(n).padStart(2, "0");
          mm = bare[2] || "00";
        }
      }

      // 2) horário citado junto de palavra de confirmação, em frase maior
      if (!hh) {
        const tm = lastIn.match(/\b(?:as|às|pode ser(?: as| às)?|fechado|bora|vamos de|confirmo)?\s*(\d{1,2})(?:[:h](\d{2})?)?\s*(?:h|hs|horas?)?\b/);
        if (tm && /\b(as|às|pode ser|fechado|bora|confirmo|vamos|então|entao|sim)\b/.test(lastIn)) {
          hh = tm[1].padStart(2, "0");
          mm = tm[2] || "00";
        }
      }

      // horários que o agente ofereceu na última mensagem: "14:00", "14h", "14 horas"
      const offeredTimes = (text: string) => {
        const out: { h: string; m: string }[] = [];
        for (const m of text.matchAll(/\b(\d{1,2}):(\d{2})\b/g)) out.push({ h: m[1].padStart(2, "0"), m: m[2] });
        for (const m of text.matchAll(/\b(\d{1,2})\s*(?:h|hs|horas?)\b/gi)) {
          const h = m[1].padStart(2, "0");
          if (!out.some((o) => o.h === h)) out.push({ h, m: "00" });
        }
        return out;
      };

      // 3) o número dito bate com um dos horários que o agente ofereceu na última mensagem
      if (!hh && lastOut) {
        const offered = offeredTimes(lastOut.content);
        if (offered.length > 0) {
          const said = lastIn.match(/\b(\d{1,2})\b/);
          if (said) {
            const n = String(parseInt(said[1], 10)).padStart(2, "0");
            const hit = offered.find((o) => o.h === n);
            if (hit) {
              hh = hit.h;
              mm = hit.m;
            }
          }
        }
      }

      // 4) confirmação genérica ("ok", "pode ser", "sim", "fechado", "👍") sem citar
      //    horário: vale quando o agente ofereceu UM horário só. Com mais de um,
      //    não dá pra adivinhar — aí ele pergunta qual, sem reofertar a lista inteira.
      let askWhichHint = "";
      if (!hh && lastOut) {
        const isAffirmation =
          /^(ok|okay|okey|blz|beleza|sim|isso|isso mesmo|claro|perfeito|otimo|ótimo|show|massa|fechado|fechou|combinado|confirmo|confirmado|pode ser|pode sim|podemos|bora|vamos|top|certo|tudo bem|tá bom|ta bom|tudo certo|👍|👍🏻|👍🏼|👍🏽|🙏|✅)[\s.!👍✅🙏]*$/.test(
            lastIn.replace(/\s+/g, " ").trim()
          );
        if (isAffirmation) {
          const uniq = Array.from(new Set(offeredTimes(lastOut.content).map((o) => `${o.h}:${o.m}`)));
          if (uniq.length === 1) {
            hh = uniq[0].split(":")[0];
            mm = uniq[0].split(":")[1];
          } else if (uniq.length > 1) {
            askWhichHint = `\n\nATENÇÃO: o lead confirmou, mas você ofereceu mais de um horário (${uniq.join(", ")}). Pergunte APENAS qual dos horários que você já ofereceu ele prefere — numa frase curta, sem consultar a agenda de novo e sem oferecer horários diferentes.`;
          }
        }
      }

      if (!hh && askWhichHint) confirmedTimeHint = askWhichHint;

      if (isNegative) {
        hh = null;
        confirmedTimeHint = "";
      }

      if (hh) {
        confirmedTimeHint = `\n\nATENÇÃO: a última mensagem do lead indica confirmação do horário ${hh}:${mm}. Se esse horário estiver livre na consulta da agenda, chame agendar_reuniao IMEDIATAMENTE com ele (use a data combinada na conversa — se o lead disse "amanhã", é o dia seguinte a hoje). Não ofereça horários de novo e não peça o horário outra vez.`;
      }
    }

    // Lead sem nome no cadastro: o agente precisa perguntar antes de agendar
    let missingNameHint = "";
    {
      const nm = String(conv.contact?.name || (leadName === "o lead" ? "" : leadName) || "").trim();
      const placeholder =
        !nm ||
        /^(n[aã]o informado|sem nome|desconhecid[oa]|lead|contato)$/i.test(nm) ||
        /^@?[\d\s()+-]+$/.test(nm) ||
        nm.startsWith("@");
      if (placeholder) {
        missingNameHint =
          "\n\nATENÇÃO: não sabemos o nome desta pessoa. Pergunte o nome dela de forma natural no início da conversa (ex: \"como posso te chamar?\") e SEMPRE antes de agendar — o nome vai no parâmetro nome_completo de agendar_reuniao.";
      }
    }

    // 7) Prompt + ferramentas
    const tools = buildTools(agent, !!conv.lead_id);
    // Instagram: dá ao agente busca na web para pesquisar a pessoa/empresa e abordar sob medida.
    if (isIG) tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 3 } as any);
    const channelLabel = isIG ? "Direct do Instagram" : "WhatsApp";

    // Abordagem 100% personalizada no Instagram (empresário → pela empresa/segmento;
    // não claro → pergunta se é empresário).
    const igPersonalization = isIG ? [
      `\n\nPERFIL DO CONTATO (Instagram): @${conv.contact?.username || "desconhecido"}${conv.contact?.name ? `, nome "${conv.contact.name}"` : ""}.`,
      `\nABORDAGEM PERSONALIZADA (siga à risca):`,
      `- Primeiro descubra se a pessoa é EMPRESÁRIA / dona de negócio. Use o @, o nome e o que ela escrever. Se precisar de mais contexto, use a ferramenta web_search pesquisando o @ ou o nome dela para identificar a empresa e o segmento.`,
      `- Se ficar claro que tem empresa: comente algo ESPECÍFICO e verdadeiro sobre o negócio/segmento dela e conecte com o que oferecemos — nada genérico, nada de "vi que você tem uma empresa".`,
      `- Se NÃO estiver claro que é empresária: diga de forma leve e humana que você busca se conectar com empresários, e PERGUNTE diretamente se ela é dona de empresa. Conduza conforme a resposta.`,
      `- NUNCA invente dados da empresa. Se a busca não trouxer nada concreto e verdadeiro, não afirme — pergunte.`,
      `- A busca é SILENCIOSA: nunca comente o processo ("vou pesquisar", "não achei nada sobre o perfil", "vou perguntar direto"). Escreva somente a mensagem final, como se a busca nunca tivesse existido.`,
    ].join("") : "";
    const system = [
      agent.instructions || "Você é um atendente comercial.",
      agent.objective ? `\nOBJETIVO: ${agent.objective}` : "",
      agent.tone ? `\nTOM DE VOZ: ${agent.tone}` : "",
      knowledge ? `\n\nBASE DE CONHECIMENTO (use quando relevante, não invente):${knowledge}` : "",
      `\n\nData/hora atual (Brasília): ${nowBR}.`,
      tools.length ? `\nVocê TEM ferramentas de agenda/funil. REGRAS DE AGENDAMENTO (obrigatórias): (1) NUNCA cite horários sem antes chamar consultar_horarios para a data — não invente horários; (2) ofereça 2-3 opções vindas da ferramenta; (3) assim que o lead confirmar um dos horários oferecidos, chame agendar_reuniao IMEDIATAMENTE com esse horário — não consulte de novo, não ofereça outros; (4) só reofereça horários se agendar_reuniao retornar erro dizendo que ocupou; (5) ANTES de chamar agendar_reuniao, você precisa do NOME, do E-MAIL e do TELEFONE/WhatsApp do lead — peça numa única mensagem curta o que faltar ("perfeito, fechei pra {horário}. Me confirma seu nome completo, e-mail e WhatsApp pra eu mandar o convite?") e só chame a ferramenta quando o lead responder; se você já sabe o nome dele pela conversa, não pergunte de novo — pergunte só o que falta; (6) passe email, telefone e nome_completo nos parâmetros de agendar_reuniao — eles vão pro cadastro do lead no CRM.` : "",
      tools.some((t: any) => t.name === "marcar_fora_do_perfil")
        ? `\nFORA DO PERFIL: se durante a conversa ficar claro que o lead não é do nosso perfil (outro segmento, sem time comercial, pessoa procurando emprego, curioso, concorrente), chame marcar_fora_do_perfil com o motivo e encerre com educação — sem insistir e sem agendar. Falta de orçamento agora ou "vou pensar" NÃO é fora de perfil: isso você trabalha como objeção.`
        : "",
      confirmedTimeHint,
      missingNameHint,
      igPersonalization,
      `\n\nÁUDIO: quando a mensagem vier como "(áudio do lead, transcrito) ...", o lead FALOU aquilo — trate como se tivesse ouvido e responda normalmente, SEMPRE em texto. Nunca diga que não conseguiu ouvir e nunca peça pra ele repetir por escrito. Só se vier "(o lead mandou um áudio que não consegui transcrever)" é que você pede, com naturalidade, que ele reescreva.`,
      `\n\nVocê está respondendo uma conversa de ${channelLabel} com ${leadName}. Responda como mensagem: curta, humana, sem markdown, sem títulos, uma ideia por mensagem. NUNCA repita uma pergunta que o lead já respondeu — antes de perguntar, confira o histórico. Escreva a resposta UMA única vez, sem repetir o texto. Nunca revele que é uma IA. Se não souber algo, seja honesto e ofereça encaminhar para uma pessoa. TUDO que você escrever é enviado ao lead exatamente como está — jamais inclua raciocínio, plano, anotação interna ou comentário sobre ferramentas no texto.`,
    ].join("");

    // Alternância user/assistant exigida pela API (mescla consecutivas, começa em user)
    const apiMessages: { role: string; content: any }[] = [];
    for (const m of msgs) {
      const role = m.direction === "inbound" ? "user" : "assistant";
      if (apiMessages.length === 0 && role === "assistant") continue;
      const last = apiMessages[apiMessages.length - 1];
      if (last && last.role === role && typeof last.content === "string") last.content += `\n${m.content}`;
      else apiMessages.push({ role, content: m.content });
    }
    if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1].role !== "user") {
      return { ok: true, skip: "sem turno do lead para responder" };
    }

    // 8) Loop de IA com tool_use (máx 5 iterações)
    const toolCalls: string[] = [];
    let reply = "";
    let lastContentShape: string[] = [];
    let retriedForSlots = false;
    for (let iter = 0; iter < 5; iter++) {
      const body: any = {
        model: agent.model || "claude-sonnet-5",
        // cache: o system (instruções + base de conhecimento) é idêntico em toda
        // iteração do loop de tools e entre mensagens da mesma conversa — sem
        // cache, cada rodada paga o preço cheio dessa parte de novo
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: apiMessages,
        max_tokens: 900,
      };
      if (tools.length) {
        body.tools = tools.map((t: any, i: number) =>
          i === tools.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t);
      }
      const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!aiResp.ok) {
        const errTxt = await aiResp.text();
        console.error("Anthropic error", aiResp.status, errTxt);
        return { ok: false, error: `IA falhou: ${aiResp.status}`, detail: errTxt.slice(0, 400) };
      }
      const aiData = await aiResp.json();
      logUsoIA("crm-agent-respond", body.model, aiData?.usage, { agente: agent?.name, canal: channel });
      const content = Array.isArray(aiData?.content) ? aiData.content : [];

      // Busca na web (server tool): o modelo pausa entre rodadas — devolve o
      // conteúdo acumulado e continua até concluir.
      if (aiData.stop_reason === "pause_turn") {
        apiMessages.push({ role: "assistant", content });
        continue;
      }

      if (aiData.stop_reason === "tool_use") {
        // executa cada tool e devolve resultado
        apiMessages.push({ role: "assistant", content });
        const toolResults: any[] = [];
        for (const block of content) {
          if (block.type !== "tool_use") continue;
          // dry_run: não executa ferramentas com efeito (agendar/mover); consulta pode
          let result: string;
          if (dry_run && block.name !== "consultar_horarios") {
            result = `[dry_run] ferramenta ${block.name} NÃO executada (simulação).`;
          } else {
            result = await runTool(supabase, agent, conv.lead_id, block.name, block.input);
          }
          toolCalls.push(`${block.name}(${JSON.stringify(block.input)}) -> ${result.slice(0, 120)}`);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
        apiMessages.push({ role: "user", content: toolResults });
        continue;
      }

      // Com web_search o modelo intercala narração ("não achei nada...") entre
      // os blocos de busca. Mensagem pro lead é SÓ o texto depois do último
      // bloco de ferramenta — narração interna não vaza.
      lastContentShape = content.map((b: any) => b?.type === "text" ? `text(${String(b.text).slice(0, 60)})` : String(b?.type));
      const lastToolIdx = content.reduce((m: number, b: any, i: number) => (b?.type !== "text" ? i : m), -1);
      const texts = content
        .filter((b: any, i: number) => b?.type === "text" && i > lastToolIdx)
        .map((b: any) => String(b.text));
      reply = [...new Set(texts)].join("").trim();
      reply = unhalve(reply);
      // Pós-checagem anti-alucinação: se houve consulta de agenda e a resposta cita
      // horários fora da lista retornada, força UMA correção.
      const lastConsult = [...toolCalls].reverse().find((t) => t.startsWith("consultar_horarios"));
      if (lastConsult && !retriedForSlots) {
        const offered = [...reply.matchAll(/\b(\d{1,2})(?:[:h](\d{2}))?\b/g)]
          .map((mm) => `${mm[1].padStart(2, "0")}:${mm[2] || "00"}`)
          .filter((t) => parseInt(t) >= 6 && parseInt(t) <= 23);
        const allowed = new Set([...lastConsult.matchAll(/\b(\d{2}:\d{2})\b/g)].map((mm) => mm[1]));
        const invalid = offered.filter((t) => !allowed.has(t));
        if (invalid.length && allowed.size) {
          retriedForSlots = true;
          apiMessages.push({ role: "assistant", content: reply });
          apiMessages.push({ role: "user", content: `[sistema] Sua resposta cita horários (${invalid.join(", ")}) que NÃO estão na lista de horários livres da agenda. Reescreva usando SOMENTE os horários da última consulta, ou agende com agendar_reuniao se o lead já confirmou um deles.` });
          reply = "";
          continue;
        }
      }
      break;
    }
    const logRun = async (outcome: string, err?: string) => {
      try {
        await supabase.from("crm_ai_agent_runs").insert({
          agent_id: agent.id, channel, conversation_id, mode, outcome,
          reply: reply ? reply.slice(0, 2000) : null,
          tool_calls: toolCalls.length ? toolCalls : null, error: err || null,
        });
      } catch { /* telemetria nunca derruba o fluxo */ }
    };
    if (!reply) { await logRun("empty_reply"); return { ok: true, skip: "resposta vazia da IA", tool_calls: toolCalls, content_shape: dry_run ? lastContentShape : undefined }; }

    if (dry_run) return { ok: true, dry_run: true, mode, agent: agent.name, reply, tool_calls: toolCalls, content_shape: lastContentShape };

    // 9) Envia (auto) ou guarda sugestão (copiloto)
    if (mode === "auto") {
      // Última verificação antes de falar: se outra execução já respondeu esta
      // conversa depois do meu gatilho, eu calo. Evita duas mensagens seguidas
      // (e contraditórias) quando o lead manda tudo junto.
      try {
        const msgTable2 = isIG ? "instagram_messages" : "crm_whatsapp_messages";
        const tsCol2 = isIG ? "timestamp" : "created_at";
        const { data: ultimaSaida } = await supabase.from(msgTable2)
          .select(`direction, ${tsCol2}`)
          .eq("conversation_id", conversation_id).eq("direction", "outbound")
          .order(tsCol2, { ascending: false }).limit(1).maybeSingle();
        const saidaTs = ultimaSaida ? new Date((ultimaSaida as any)[tsCol2]).getTime() : 0;
        const gatilhoTs = triggerTs ? new Date(triggerTs).getTime() : 0;
        if (saidaTs && gatilhoTs && saidaTs > gatilhoTs) {
          await logRun("skipped_duplicate");
          return { ok: true, skip: "outra execução já respondeu esta conversa" };
        }
      } catch { /* se a checagem falhar, segue o fluxo normal */ }

      if (isIG) {
        const { error: sendErr } = await supabase.functions.invoke("instagram-send", {
          body: { conversationId: conversation_id, message: reply, staffId: null },
        });
        if (sendErr) return { ok: false, error: "falha ao enviar DM", detail: String(sendErr) };
      } else {
        const phone = String(conv.contact?.phone || "").replace(/\D/g, "");
        const sent = await sendWhatsAppText(supabase, conv.instance_id, phone, reply);
        if (!sent.ok) { await logRun("send_failed", sent.error); return { ok: false, error: "falha ao enviar WhatsApp", detail: sent.error }; }
        // NÃO insere a mensagem aqui: o eco do webhook do Stevo já grava o outbound
        // (com remote_id). Gravar dos dois lados duplicava o histórico e o modelo
        // passava a IMITAR o padrão, gerando o texto 2x dentro da própria resposta.
        await supabase.from("crm_whatsapp_conversations").update({
          last_message: reply.substring(0, 255), last_message_at: new Date().toISOString(),
        }).eq("id", conversation_id);
      }
      await logRun("sent");
      return { ok: true, mode: "auto", sent: true, agent: agent.name, tool_calls: toolCalls };
    } else {
      await supabase.from("crm_ai_suggested_replies").insert({
        agent_id: agent.id, channel, conversation_id, content: reply, status: "pending",
      });
      await logRun("suggested");
      return { ok: true, mode: "copilot", suggested: true, agent: agent.name, tool_calls: toolCalls };
    }
    } // fim processConversation
  } catch (e) {
    console.error("crm-agent-respond error", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
