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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const { channel, conversation_id, dry_run } = await req.json();
    if (channel !== "instagram") return j({ ok: false, skip: "canal não suportado ainda" });
    if (!conversation_id) return j({ ok: false, error: "conversation_id obrigatório" }, 400);

    // 1) Conversa + instância + lead
    const { data: conv } = await supabase
      .from("instagram_conversations")
      .select("id, instance_id, contact_id, lead_id, contact:instagram_contacts(name, username)")
      .eq("id", conversation_id).maybeSingle();
    if (!conv) return j({ ok: false, error: "conversa não encontrada" });

    // 2) Agente ativo vinculado a esta instância do Instagram
    const { data: chRows } = await supabase
      .from("crm_ai_agent_channels")
      .select("agent_id, agent:crm_ai_agents(*)")
      .eq("channel", "instagram").eq("instance_id", conv.instance_id);
    const agents = (chRows || []).map((r: any) => r.agent).filter((a: any) => a && a.is_active);
    if (agents.length === 0) return j({ ok: true, skip: "nenhum agente ativo nesta instância" });
    // ordena pelo mais antigo (determinístico) e pega o primeiro
    agents.sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1));
    const agent = agents[0];

    // 3) Modo: override da conversa > funil do lead > padrão do agente
    let mode = agent.reply_mode || "copilot";
    const { data: override } = await supabase
      .from("crm_ai_agent_conversation_overrides")
      .select("enabled, reply_mode").eq("conversation_id", conversation_id).eq("channel", "instagram").maybeSingle();
    if (override && override.enabled === false) return j({ ok: true, skip: "agente desligado nesta conversa" });
    if (override?.reply_mode) {
      mode = override.reply_mode;
    } else if (conv.lead_id) {
      const { data: lead } = await supabase.from("crm_leads").select("pipeline_id").eq("id", conv.lead_id).maybeSingle();
      if (lead?.pipeline_id) {
        const { data: bind } = await supabase.from("crm_ai_agent_pipelines")
          .select("reply_mode").eq("agent_id", agent.id).eq("pipeline_id", lead.pipeline_id).maybeSingle();
        if (bind?.reply_mode) mode = bind.reply_mode; // funil configurado manda
      }
    }
    if (mode === "off") return j({ ok: true, skip: "modo desligado para este funil" });

    // 4) Histórico da conversa
    const { data: history } = await supabase
      .from("instagram_messages")
      .select("direction, content, message_type, timestamp")
      .eq("conversation_id", conversation_id)
      .order("timestamp", { ascending: true })
      .limit(40);
    const msgs = (history || []).filter((m: any) => (m.content || "").trim().length > 0);
    if (msgs.length === 0) return j({ ok: true, skip: "sem conteúdo textual" });
    // precisa terminar em mensagem do lead (inbound), senão não há o que responder
    if (msgs[msgs.length - 1].direction !== "inbound") return j({ ok: true, skip: "última mensagem não é do lead" });

    // Anti-rajada: se o agente já respondeu nos últimos 12s, não dispara de novo
    // (lead que manda várias mensagens seguidas gera vários triggers).
    const lastOut = [...msgs].reverse().find((m: any) => m.direction === "outbound");
    if (lastOut) {
      const ageMs = Date.now() - new Date(lastOut.timestamp).getTime();
      if (ageMs < 12000) return j({ ok: true, skip: "resposta recente do agente (debounce)" });
    }

    // 5) Guardrails: máx. de mensagens do agente + palavras de handoff
    const outboundCount = msgs.filter((m: any) => m.direction === "outbound").length;
    if (agent.max_messages && outboundCount >= agent.max_messages) return j({ ok: true, skip: "limite de mensagens atingido" });
    const lastInbound = (msgs[msgs.length - 1].content || "").toLowerCase();
    const handoff = (agent.handoff_keywords || []).some((k: string) => k && lastInbound.includes(k.toLowerCase()));
    if (handoff) return j({ ok: true, skip: "handoff acionado por palavra-chave" });

    // 6) Base de conhecimento (texto pronto)
    const { data: kn } = await supabase
      .from("crm_ai_agent_knowledge")
      .select("title, content").eq("agent_id", agent.id).eq("status", "ready");
    let knowledge = "";
    for (const k of (kn || [])) {
      if (!k.content) continue;
      knowledge += `\n\n### ${k.title || "Fonte"}\n${k.content}`;
      if (knowledge.length > 18000) break;
    }
    if (knowledge.length > 18000) knowledge = knowledge.slice(0, 18000);

    const leadName = (conv as any).contact?.name || (conv as any).contact?.username || "o lead";

    // 7) Monta prompt
    const system = [
      agent.instructions || "Você é um atendente comercial.",
      agent.objective ? `\nOBJETIVO: ${agent.objective}` : "",
      agent.tone ? `\nTOM DE VOZ: ${agent.tone}` : "",
      knowledge ? `\n\nBASE DE CONHECIMENTO (use quando relevante, não invente):${knowledge}` : "",
      `\n\nVocê está respondendo uma conversa de Direct do Instagram com ${leadName}. Responda como mensagem de DM: curta, humana, sem markdown, sem títulos, uma ideia por mensagem. Nunca revele que é uma IA. Se não souber algo, seja honesto e ofereça encaminhar para uma pessoa.`,
    ].join("");

    // A API da Anthropic exige papéis ALTERNADOS e começar com 'user'. O histórico
    // do IG costuma ter várias mensagens seguidas do mesmo lado → mescla consecutivas
    // e descarta mensagens 'assistant' iniciais.
    const apiMessages: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of msgs) {
      const role: "user" | "assistant" = m.direction === "inbound" ? "user" : "assistant";
      if (apiMessages.length === 0 && role === "assistant") continue; // precisa começar com user
      const last = apiMessages[apiMessages.length - 1];
      if (last && last.role === role) last.content += `\n${m.content}`;
      else apiMessages.push({ role, content: m.content });
    }
    if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1].role !== "user") {
      return j({ ok: true, skip: "sem turno do lead para responder" });
    }

    // 8) Chama a IA
    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: agent.model || "claude-sonnet-5",
        system,
        messages: apiMessages,
        max_tokens: 700,
        // temperature omitido: modelos novos (Sonnet 5+) o deprecaram e retornam 400
      }),
    });
    if (!aiResp.ok) {
      const errTxt = await aiResp.text();
      console.error("Anthropic error", aiResp.status, errTxt);
      return j({ ok: false, error: `IA falhou: ${aiResp.status}`, detail: errTxt.slice(0, 500) }, 200);
    }
    const aiData = await aiResp.json();
    // Concatena todos os blocos de texto (modelos podem devolver múltiplos blocos)
    const reply = (Array.isArray(aiData?.content)
      ? aiData.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("").trim()
      : "");
    if (!reply) {
      return j({ ok: true, skip: "resposta vazia da IA", stop_reason: aiData?.stop_reason,
        content_types: Array.isArray(aiData?.content) ? aiData.content.map((b: any) => b?.type) : null });
    }

    // dry_run: valida geração e resolução de modo SEM enviar nem gravar nada
    if (dry_run) return j({ ok: true, dry_run: true, mode, agent: agent.name, reply });

    // 9) Envia (auto) ou guarda sugestão (copiloto)
    if (mode === "auto") {
      const { error: sendErr } = await supabase.functions.invoke("instagram-send", {
        body: { conversationId: conversation_id, message: reply, staffId: null },
      });
      if (sendErr) {
        console.error("instagram-send error", sendErr);
        return j({ ok: false, error: "falha ao enviar DM", detail: String(sendErr) }, 200);
      }
      return j({ ok: true, mode: "auto", sent: true, agent: agent.name });
    } else {
      await supabase.from("crm_ai_suggested_replies").insert({
        agent_id: agent.id, channel: "instagram", conversation_id, content: reply, status: "pending",
      });
      return j({ ok: true, mode: "copilot", suggested: true, agent: agent.name });
    }
  } catch (e) {
    console.error("crm-agent-respond error", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
