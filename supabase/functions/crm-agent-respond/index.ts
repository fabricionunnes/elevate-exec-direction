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

// ---------- Envio WhatsApp (mesmo transporte do survey-sender: Stevo/Manager V2 vs Evolution legado) ----------
async function sendWhatsAppText(supabase: any, instanceId: string, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name, api_url, api_key, provider_type, status")
    .eq("id", instanceId).maybeSingle();
  if (!instance) return { ok: false, error: "instância não encontrada" };
  if (instance.status !== "connected") return { ok: false, error: `instância ${instance.instance_name} desconectada` };
  const apiUrl = instance.api_url || Deno.env.get("EVOLUTION_API_URL");
  const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return { ok: false, error: "instância sem api_url/api_key" };
  const baseUrl = String(apiUrl).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  let isV2 = instance.provider_type === "manager_v2";
  try { if (!isV2) isV2 = new URL(baseUrl).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { /* noop */ }
  const sendUrl = isV2 ? `${baseUrl}/send/text` : `${baseUrl}/message/sendText/${instance.instance_name}`;
  const headers: Record<string, string> = isV2
    ? { "Content-Type": "application/json", apikey: apiKey }
    : { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}` };
  const resp = await fetch(sendUrl, { method: "POST", headers, body: JSON.stringify({ number: phone, text: message, delay: 0 }) });
  if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}: ${(await resp.text()).slice(0, 120)}` };
  return { ok: true };
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
    if (hasLead) {
      tools.push({
        name: "agendar_reuniao",
        description: "Agenda a reunião na agenda do closer no horário confirmado pelo lead. SÓ use depois que o lead confirmar explicitamente um horário que você ofereceu via consultar_horarios.",
        input_schema: {
          type: "object",
          properties: {
            data_hora: { type: "string", description: "Data e hora confirmadas, formato YYYY-MM-DDTHH:MM (horário de Brasília)" },
            titulo: { type: "string", description: "Título curto da reunião, ex: 'Reunião UNV x Nome do Lead'" },
          },
          required: ["data_hora", "titulo"],
        },
      });
    }
  }
  if (agent.can_move_stage && hasLead) {
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
      return results.join("\n") || "Nenhum closer configurado.";
    }

    if (name === "agendar_reuniao") {
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
      const startISO = `${m[1]}T${m[2]}:${m[3]}:00-03:00`;
      const endDate = new Date(new Date(startISO).getTime() + dur * 60000);
      // fim no mesmo fuso -03:00
      const endISO = new Date(endDate.getTime() - 3 * 3600000).toISOString().slice(0, 19) + "-03:00";
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar?action=create-event`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title, startDateTime: startISO, endDateTime: endISO, target_user_id: staff.user_id }),
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
      }
      const link = ev.event?.meetingLink ? ` Link da reunião: ${ev.event.meetingLink}` : "";
      return `Reunião agendada com ${staff.name} em ${m[1]} às ${m[2]}:${m[3]}.${link}`;
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

    // 2) Agente ativo vinculado a esta instância/canal
    const { data: chRows } = await supabase
      .from("crm_ai_agent_channels")
      .select("agent_id, agent:crm_ai_agents(*)")
      .eq("channel", channel).eq("instance_id", conv.instance_id);
    const agents = (chRows || []).map((r: any) => r.agent).filter((a: any) => a && a.is_active);
    if (agents.length === 0) return j({ ok: true, skip: "nenhum agente ativo nesta instância" });
    agents.sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1));
    const agent = agents[0];

    // 3) Modo: override da conversa > funil do lead > padrão do agente
    let mode = agent.reply_mode || "copilot";
    const { data: override } = await supabase
      .from("crm_ai_agent_conversation_overrides")
      .select("enabled, reply_mode").eq("conversation_id", conversation_id).eq("channel", channel).maybeSingle();
    if (override && override.enabled === false) return j({ ok: true, skip: "agente desligado nesta conversa" });
    if (override?.reply_mode) {
      mode = override.reply_mode;
    } else if (conv.lead_id) {
      const { data: lead } = await supabase.from("crm_leads").select("pipeline_id").eq("id", conv.lead_id).maybeSingle();
      if (lead?.pipeline_id) {
        const { data: bind } = await supabase.from("crm_ai_agent_pipelines")
          .select("reply_mode").eq("agent_id", agent.id).eq("pipeline_id", lead.pipeline_id).maybeSingle();
        if (bind?.reply_mode) mode = bind.reply_mode;
      }
    }
    if (mode === "off") return j({ ok: true, skip: "modo desligado para este funil" });

    // 4) Histórico
    let msgs: { direction: string; content: string; ts: string }[] = [];
    if (isIG) {
      const { data: history } = await supabase.from("instagram_messages")
        .select("direction, content, timestamp").eq("conversation_id", conversation_id)
        .order("timestamp", { ascending: true }).limit(40);
      msgs = (history || []).map((m: any) => ({ direction: m.direction, content: m.content || "", ts: m.timestamp }));
    } else {
      const { data: history } = await supabase.from("crm_whatsapp_messages")
        .select("direction, content, created_at").eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true }).limit(40);
      msgs = (history || []).map((m: any) => ({ direction: m.direction, content: m.content || "", ts: m.created_at }));
    }
    msgs = msgs.filter((m) => m.content.trim().length > 0);
    if (msgs.length === 0) return j({ ok: true, skip: "sem conteúdo textual" });
    if (msgs[msgs.length - 1].direction !== "inbound") return j({ ok: true, skip: "última mensagem não é do lead" });

    // Anti-rajada: agente respondeu há <12s → não dispara de novo
    const lastOut = [...msgs].reverse().find((m) => m.direction === "outbound");
    if (lastOut && Date.now() - new Date(lastOut.ts).getTime() < 12000) {
      return j({ ok: true, skip: "resposta recente do agente (debounce)" });
    }

    // 5) Guardrails
    const outboundCount = msgs.filter((m) => m.direction === "outbound").length;
    if (agent.max_messages && outboundCount >= agent.max_messages) return j({ ok: true, skip: "limite de mensagens atingido" });
    const lastInbound = msgs[msgs.length - 1].content.toLowerCase();
    const handoff = (agent.handoff_keywords || []).some((k: string) => k && lastInbound.includes(k.toLowerCase()));
    if (handoff) return j({ ok: true, skip: "handoff acionado por palavra-chave" });

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

    // 7) Prompt + ferramentas
    const tools = buildTools(agent, !!conv.lead_id);
    const channelLabel = isIG ? "Direct do Instagram" : "WhatsApp";
    const system = [
      agent.instructions || "Você é um atendente comercial.",
      agent.objective ? `\nOBJETIVO: ${agent.objective}` : "",
      agent.tone ? `\nTOM DE VOZ: ${agent.tone}` : "",
      knowledge ? `\n\nBASE DE CONHECIMENTO (use quando relevante, não invente):${knowledge}` : "",
      `\n\nData/hora atual (Brasília): ${nowBR}.`,
      tools.length ? `\nVocê TEM ferramentas de agenda/funil. Para agendar: consulte horários com consultar_horarios, ofereça 2-3 opções, e SÓ agende com agendar_reuniao após o lead confirmar um horário.` : "",
      `\n\nVocê está respondendo uma conversa de ${channelLabel} com ${leadName}. Responda como mensagem: curta, humana, sem markdown, sem títulos, uma ideia por mensagem. Nunca revele que é uma IA. Se não souber algo, seja honesto e ofereça encaminhar para uma pessoa.`,
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
      return j({ ok: true, skip: "sem turno do lead para responder" });
    }

    // 8) Loop de IA com tool_use (máx 5 iterações)
    const toolCalls: string[] = [];
    let reply = "";
    for (let iter = 0; iter < 5; iter++) {
      const body: any = {
        model: agent.model || "claude-sonnet-5",
        system,
        messages: apiMessages,
        max_tokens: 900,
      };
      if (tools.length) body.tools = tools;
      const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!aiResp.ok) {
        const errTxt = await aiResp.text();
        console.error("Anthropic error", aiResp.status, errTxt);
        return j({ ok: false, error: `IA falhou: ${aiResp.status}`, detail: errTxt.slice(0, 400) }, 200);
      }
      const aiData = await aiResp.json();
      const content = Array.isArray(aiData?.content) ? aiData.content : [];

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

      reply = content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("").trim();
      break;
    }
    if (!reply) return j({ ok: true, skip: "resposta vazia da IA", tool_calls: toolCalls });

    if (dry_run) return j({ ok: true, dry_run: true, mode, agent: agent.name, reply, tool_calls: toolCalls });

    // 9) Envia (auto) ou guarda sugestão (copiloto)
    if (mode === "auto") {
      if (isIG) {
        const { error: sendErr } = await supabase.functions.invoke("instagram-send", {
          body: { conversationId: conversation_id, message: reply, staffId: null },
        });
        if (sendErr) return j({ ok: false, error: "falha ao enviar DM", detail: String(sendErr) }, 200);
      } else {
        const phone = String(conv.contact?.phone || "").replace(/\D/g, "");
        const sent = await sendWhatsAppText(supabase, conv.instance_id, phone, reply);
        if (!sent.ok) return j({ ok: false, error: "falha ao enviar WhatsApp", detail: sent.error }, 200);
        // registra a mensagem outbound e atualiza a conversa
        await supabase.from("crm_whatsapp_messages").insert({
          conversation_id, content: reply, type: "text", direction: "outbound", status: "sent", sent_by: null,
        });
        await supabase.from("crm_whatsapp_conversations").update({
          last_message: reply.substring(0, 255), last_message_at: new Date().toISOString(),
        }).eq("id", conversation_id);
      }
      return j({ ok: true, mode: "auto", sent: true, agent: agent.name, tool_calls: toolCalls });
    } else {
      await supabase.from("crm_ai_suggested_replies").insert({
        agent_id: agent.id, channel, conversation_id, content: reply, status: "pending",
      });
      return j({ ok: true, mode: "copilot", suggested: true, agent: agent.name, tool_calls: toolCalls });
    }
  } catch (e) {
    console.error("crm-agent-respond error", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
