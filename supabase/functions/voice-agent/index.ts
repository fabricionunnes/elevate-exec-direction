// Assistente de VOZ (piloto, 22/09/2026): liga pro lead pela Retell (voz ElevenLabs) usando o
// mesmo cérebro do CRM. Nada liga enquanto crm_settings.voice_agent_enabled = false.
//   ?action=tick          cron 5/5 min: lead novo sem resposta no WhatsApp há N min → liga (funis permitidos / flag do lead)
//   ?action=start_call    { lead_id, reason }  (equipe logada, service role ou x-voice-secret)
//   ?action=status        { lead_id? } → config (sem chaves) + últimas ligações do lead (equipe logada)
//   ?action=context       { phone | lead_id } → variáveis dinâmicas da ligação
//   ?action=tool          webhook de função da Retell → roda a ferramenta do agente (agenda, CRM)
//   ?action=webhook       eventos da Retell (call_started / call_ended / call_analyzed)
//   ?action=setup_retell  (admin) cria/atualiza LLM + agente na Retell com o prompt e as ferramentas
//   ?action=setup_twilio  (admin) cria o tronco SIP na Twilio e importa o número na Retell
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VOICE_SECRET = Deno.env.get("VOICE_AGENT_SECRET") || "";
const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY") || "";
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-voice-secret" };
const j = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const TZ = "America/Sao_Paulo";
const FN_URL = `${SUPABASE_URL}/functions/v1/voice-agent`;
const digits = (p: string) => (p || "").replace(/\D/g, "");
const e164 = (p: string) => { const d = digits(p); if (!d) return ""; return "+" + (d.startsWith("55") && d.length >= 12 ? d : `55${d}`); };
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...o }).format(d);

async function setting<T>(key: string, def: T): Promise<T> {
  const { data } = await sb.from("crm_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  return (data?.setting_value ?? def) as T;
}
async function setSetting(key: string, value: unknown) {
  await sb.from("crm_settings").upsert({ setting_key: key, setting_value: value as any }, { onConflict: "setting_key" });
}
function papel(req: Request): string {
  try { const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); return String(JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role || ""); } catch { return ""; }
}
function autorizado(req: Request, url: URL): boolean {
  if (VOICE_SECRET && (req.headers.get("x-voice-secret") === VOICE_SECRET || url.searchParams.get("secret") === VOICE_SECRET)) return true;
  return papel(req) === "service_role";
}
// equipe logada (JWT do usuário) → { id, name, role } ou null
async function staffDoToken(req: Request): Promise<{ id: string; name: string; role: string } | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const { data } = await createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } }).auth.getUser();
  const uid = data?.user?.id; if (!uid) return null;
  const { data: st } = await sb.from("onboarding_staff").select("id, name, role").eq("user_id", uid).eq("is_active", true).maybeSingle();
  return st as any;
}
function dentroDoHorario(faixa: string): boolean {
  const [ini, fim] = String(faixa || "09:00-19:00").split("-");
  const agora = new Date(); const dow = new Date(agora.toLocaleString("en-US", { timeZone: TZ })).getDay();
  if (dow === 0 || dow === 6) return false;
  const hm = fmt(agora, { hour: "2-digit", minute: "2-digit", hour12: false });
  return hm >= ini && hm <= fim;
}

// ---------- contexto do lead (vira variável dinâmica na Retell) ----------
const CAMPOS_LEAD = "id, name, company, phone, email, segment, origin, notes, owner_staff_id, closer_staff_id, stage_id, pipeline_id, created_at, voice_calls_enabled";
async function contexto(leadId: string | null, phone: string | null) {
  let lead: any = null;
  if (leadId) ({ data: lead } = await sb.from("crm_leads").select(CAMPOS_LEAD).eq("id", leadId).maybeSingle());
  if (!lead && phone) {
    const { data: id } = await sb.rpc("crm_find_lead_by_phone", { p_phone: phone });
    if (id) ({ data: lead } = await sb.from("crm_leads").select(CAMPOS_LEAD).eq("id", id).maybeSingle());
  }
  if (!lead) return { lead: null, vars: { nome: "", primeiro_nome: "", empresa: "", origem: "", historico: "", closer: "", closer_primeiro_nome: "", reuniao: "", hoje: fmt(new Date(), { weekday: "long", day: "2-digit", month: "2-digit" }) } };
  const closerId = lead.closer_staff_id || lead.owner_staff_id;
  const [{ data: closer }, { data: convs }, { data: reunioes }, { data: etapa }] = await Promise.all([
    closerId ? sb.from("onboarding_staff").select("name").eq("id", closerId).maybeSingle() : Promise.resolve({ data: null } as any),
    sb.from("crm_whatsapp_conversations").select("id").eq("lead_id", lead.id),
    sb.from("crm_activities").select("title, scheduled_at, meeting_link").eq("lead_id", lead.id).eq("type", "meeting").eq("status", "pending").gt("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1),
    lead.stage_id ? sb.from("crm_stages").select("name").eq("id", lead.stage_id).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);
  let historico = "";
  const convIds = (convs || []).map((c: any) => c.id);
  if (convIds.length) {
    const { data: msgs } = await sb.from("crm_whatsapp_messages").select("direction, content, created_at").in("conversation_id", convIds).order("created_at", { ascending: false }).limit(12);
    historico = (msgs || []).reverse().filter((m: any) => m.content).map((m: any) => `${m.direction === "inbound" ? "Lead" : "UNV"}: ${String(m.content).slice(0, 200)}`).join("\n");
  }
  const r = (reunioes || [])[0];
  const nome = String(lead.name || "").trim();
  return {
    lead,
    vars: {
      nome, primeiro_nome: nome.split(/\s+/)[0] || "", empresa: lead.company || "", segmento: lead.segment || "", origem: lead.origin || "",
      etapa: etapa?.name || "", closer: closer?.name || "", closer_primeiro_nome: String(closer?.name || "").split(/\s+/)[0] || "",
      historico, reuniao: r ? `${fmt(new Date(r.scheduled_at), { weekday: "long", day: "2-digit", month: "2-digit" })} às ${fmt(new Date(r.scheduled_at), { hour: "2-digit", minute: "2-digit" })}` : "",
      hoje: fmt(new Date(), { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }),
    },
  };
}

// ---------- Retell ----------
async function retell(path: string, method = "GET", body?: unknown) {
  if (!RETELL_API_KEY) throw new Error("RETELL_API_KEY não configurada");
  const r = await fetch(`https://api.retellai.com${path}`, { method, headers: { Authorization: `Bearer ${RETELL_API_KEY}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Retell ${method} ${path}: ${r.status} ${JSON.stringify(d).slice(0, 300)}`);
  return d;
}

// ---------- disparar ligação ----------
async function startCall(leadId: string, reason: string, por?: string) {
  const { lead, vars } = await contexto(leadId, null);
  if (!lead) return { ok: false, error: "lead não encontrado" };
  if (lead.voice_calls_enabled === false && reason !== "manual") return { ok: false, error: "ligação por IA desligada neste lead" };
  const to = e164(lead.phone || "");
  if (!to || to.length < 13) return { ok: false, error: "lead sem celular válido" };
  const agentId = await setting<string>("retell_agent_id", "");
  const from = await setting<string>("retell_from_number", "");
  const { data: row } = await sb.from("crm_voice_calls").insert({ lead_id: lead.id, phone: to, reason, dynamic_vars: { ...vars, por }, status: "queued" }).select("id").single();
  if (!RETELL_API_KEY || !agentId || !from) {
    await sb.from("crm_voice_calls").update({ status: "skipped", error: "Retell não configurada (chave, agente ou número)" }).eq("id", row!.id);
    return { ok: false, error: "Retell não configurada (chave, agente ou número)", call_id: row!.id };
  }
  try {
    const d = await retell("/v2/create-phone-call", "POST", {
      from_number: from, to_number: to, override_agent_id: agentId,
      retell_llm_dynamic_variables: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v ?? "")])),
      metadata: { lead_id: lead.id, call_row_id: row!.id, reason },
    });
    await sb.from("crm_voice_calls").update({ status: "dialing", provider_call_id: d.call_id, started_at: new Date().toISOString() }).eq("id", row!.id);
    return { ok: true, call_id: row!.id, retell_call_id: d.call_id };
  } catch (e) {
    await sb.from("crm_voice_calls").update({ status: "failed", error: String(e).slice(0, 300) }).eq("id", row!.id);
    return { ok: false, error: String(e).slice(0, 300), call_id: row!.id };
  }
}

// ---------- vigia: lead novo sem resposta no WhatsApp ----------
async function tick(dry: boolean) {
  const enabled = await setting<boolean>("voice_agent_enabled", false);
  if (!enabled && !dry) return { skipped: "voice_agent_enabled = false" };
  if (!(await setting<boolean>("voice_trigger_no_reply", true)) && !dry) return { skipped: "gatilho 'sem resposta' desligado" };
  if (!dentroDoHorario(await setting<string>("voice_hours", "09:00-19:00"))) return { skipped: "fora do horário" };
  const funis = new Set<string>(await setting<string[]>("voice_pipeline_ids", []));
  const minutos = Number(await setting<number>("voice_no_reply_minutes", 10)) || 10;
  const maxDia = Number(await setting<number>("voice_max_calls_per_day", 30)) || 30;
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: TZ })); hoje.setHours(0, 0, 0, 0);
  const inicioHoje = new Date(hoje.getTime() + 3 * 3600000).toISOString();
  const { count: feitas } = await sb.from("crm_voice_calls").select("id", { count: "exact", head: true }).gte("created_at", inicioHoje);
  if ((feitas || 0) >= maxDia) return { skipped: `limite diário (${maxDia})` };
  const limite = new Date(Date.now() - minutos * 60000).toISOString();
  const desde = new Date(Date.now() - 3 * 3600000).toISOString();
  // conversa criada hoje, última mensagem foi NOSSA há >= N min (e < 3h), lead sem resposta desde então
  const { data: convs } = await sb.from("crm_whatsapp_conversations")
    .select("id, lead_id, last_message_at, last_inbound_at, created_at, lead:crm_leads(id, name, phone, pipeline_id, voice_calls_enabled)")
    .eq("last_message_direction", "outbound").not("lead_id", "is", null)
    .gte("created_at", inicioHoje)
    .lte("last_message_at", limite).gte("last_message_at", desde).limit(100);
  const saida: any[] = [];
  for (const c of (convs || []) as any[]) {
    const lead = c.lead; if (!lead?.phone) continue;
    if (lead.voice_calls_enabled === false) continue;                                  // desligado neste lead
    if (lead.voice_calls_enabled !== true && !funis.has(lead.pipeline_id)) continue;    // funil não liberado
    if (c.last_inbound_at && c.last_inbound_at > c.last_message_at) continue;
    const { data: ja } = await sb.from("crm_voice_calls").select("id").eq("lead_id", lead.id).gte("created_at", desde).limit(1);
    if (ja?.length) continue;
    if (dry) { saida.push({ lead: lead.name, phone: lead.phone, motivo: "sem resposta" }); continue; }
    saida.push({ lead: lead.name, ...(await startCall(lead.id, "sem_resposta")) });
    if (saida.length >= 5) break; // no máximo 5 ligações por passada
  }
  return { candidatos: saida.length, saida };
}

// ---------- ferramentas (Retell custom function) ----------
async function tool(body: any) {
  const name = String(body.name || body.tool || "");
  const args = body.args || body.arguments || body.tool_input || {};
  const meta = body.call?.metadata || body.metadata || {};
  let leadId: string | null = meta.lead_id || null;
  if (!leadId && (body.call?.to_number || body.call?.from_number)) {
    const phone = body.call?.direction === "inbound" ? body.call?.from_number : body.call?.to_number;
    const { data: id } = await sb.rpc("crm_find_lead_by_phone", { p_phone: phone }); leadId = id || null;
  }
  const agentId = await setting<string>("voice_agent_id", "");
  if (name === "contexto") return { result: (await contexto(leadId, null)).vars };
  if (name === "anotar") {
    if (leadId) await sb.from("crm_activities").insert({ lead_id: leadId, type: "note", title: "Anotação da ligação (assistente de voz)", description: String(args.texto || ""), status: "completed", completed_at: new Date().toISOString() });
    return { result: "anotado" };
  }
  const permitidas = ["consultar_horarios", "agendar_reuniao", "salvar_dados_lead", "mover_etapa", "marcar_perdido", "marcar_fora_do_perfil"];
  if (!permitidas.includes(name)) return { result: `ferramenta desconhecida: ${name}` };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/crm-agent-respond`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "test_tool", agent_id: agentId, lead_id: leadId, tool: name, tool_input: args }),
  });
  const d = await r.json().catch(() => ({}));
  return { result: d?.result ?? d?.error ?? "sem retorno" };
}

// ---------- eventos da Retell ----------
async function webhook(body: any) {
  const ev = String(body.event || ""); const call = body.call || {};
  const meta = call.metadata || {}; const id = meta.call_row_id;
  let row: any = null;
  if (id) ({ data: row } = await sb.from("crm_voice_calls").select("id, lead_id").eq("id", id).maybeSingle());
  if (!row && call.call_id) ({ data: row } = await sb.from("crm_voice_calls").select("id, lead_id").eq("provider_call_id", call.call_id).maybeSingle());
  if (!row && call.call_id) { // ligação recebida (inbound) ou disparada fora do Nexus
    const phone = call.direction === "inbound" ? call.from_number : call.to_number;
    const { data: leadId } = await sb.rpc("crm_find_lead_by_phone", { p_phone: phone });
    ({ data: row } = await sb.from("crm_voice_calls").insert({ lead_id: leadId || null, phone: phone || "", reason: call.direction === "inbound" ? "recebida" : "manual", provider_call_id: call.call_id, status: "in_progress", started_at: new Date().toISOString() }).select("id, lead_id").single());
  }
  if (!row) return { ok: true, ignored: ev };
  const upd: any = { updated_at: new Date().toISOString() };
  if (ev === "call_started") upd.status = "in_progress";
  if (ev === "call_ended" || ev === "call_analyzed") {
    upd.status = "ended"; upd.ended_at = new Date().toISOString();
    if (call.transcript) upd.transcript = call.transcript;
    if (call.recording_url) upd.recording_url = call.recording_url;
    if (call.start_timestamp && call.end_timestamp) upd.duration_seconds = Math.round((call.end_timestamp - call.start_timestamp) / 1000);
    if (call.call_cost?.combined_cost != null) upd.cost_cents = Math.round(Number(call.call_cost.combined_cost)); // centavos de dólar
    if (call.disconnection_reason) upd.disposition = call.disconnection_reason;
  }
  if (ev === "call_analyzed") {
    const a = call.call_analysis || {};
    upd.summary = a.call_summary || null;
    if (a.user_sentiment) upd.disposition = `${a.call_successful ? "sucesso" : "sem_sucesso"} · ${a.user_sentiment}`;
    if (row.lead_id) await sb.from("crm_activities").insert({
      lead_id: row.lead_id, type: "call", status: "completed", completed_at: new Date().toISOString(),
      title: "Ligação da assistente de voz", description: [a.call_summary, call.recording_url ? `Gravação: ${call.recording_url}` : ""].filter(Boolean).join("\n\n"),
    });
  }
  await sb.from("crm_voice_calls").update(upd).eq("id", row.id);
  return { ok: true, event: ev };
}

// ---------- prompt e ferramentas do agente na Retell ----------
const PROMPT_PADRAO = `## Quem você é
Você é a assistente comercial da UNV (Universidade Nacional de Vendas), a empresa do Fabrício Nunnes. Você trabalha junto com {{closer}}, que é quem faz a reunião de diagnóstico com o empresário. Você está ligando de um número da UNV.
Se perguntarem se você é um robô ou uma inteligência artificial, responda com naturalidade e sem enrolar: "Sou a assistente do {{closer_primeiro_nome}} aqui na UNV, ele é quem vai te atender na reunião. Posso te ajudar a marcar?". Nunca minta sobre isso e nunca diga que é humana.

## Contexto desta ligação
Hoje é {{hoje}}. Lead: {{nome}} (chame de {{primeiro_nome}}). Empresa: {{empresa}}. Segmento: {{segmento}}. Veio por: {{origem}}. Etapa no funil: {{etapa}}. Reunião já marcada (se houver): {{reuniao}}.
Últimas mensagens trocadas no WhatsApp:
{{historico}}

## Objetivo
Uma coisa só: marcar (ou confirmar) a reunião de diagnóstico gratuito com {{closer}}. Ligação curta, de 2 a 4 minutos. Se o lead quiser falar do negócio, ouça um pouco e volte ao objetivo.

## Como falar
Como uma pessoa no telefone: frases curtas, uma pergunta por vez, espere a resposta. Sem lista, sem "perfeito", sem "com certeza", sem repetir o nome da pessoa em toda frase. Pode dizer "uhum", "tá", "entendi", "deixa eu ver aqui" enquanto consulta a agenda. Se a pessoa interromper, pare e ouça. Nunca fale de preço: isso é assunto da reunião, o diagnóstico é gratuito. Nunca invente horário: só ofereça o que veio da ferramenta consultar_horarios.

## Roteiro (guia, não script)
1. Abertura: "Oi, {{primeiro_nome}}? Aqui é a assistente do {{closer_primeiro_nome}}, da UNV. Tudo bem? Te liguei rapidinho porque você chamou a gente no WhatsApp e a gente não conseguiu se falar. Tem um minutinho?" Se não puder agora, pergunte um horário melhor, chame anotar e encerre.
2. Uma pergunta de dor: "Hoje o que mais te incomoda nas vendas aí na {{empresa}}: é a quantidade de cliente chegando ou o time que não fecha?"
3. Convite: "O {{closer_primeiro_nome}} faz uma conversa de diagnóstico, gratuita, de uns 40 minutos, pra olhar isso com você e te dar um direcionamento. Amanhã de manhã ou de tarde fica melhor?"
4. Horário: chame consultar_horarios com a data. Ofereça no máximo dois horários. Quando confirmar um, peça o e-mail se não tiver e chame agendar_reuniao.
5. Fechamento: "Fechado então, {{dia e hora}}. Vai chegar o convite no e-mail e no WhatsApp. Qualquer imprevisto, me avisa por lá. Obrigada, {{primeiro_nome}}." e encerre a ligação.

## Situações
Caixa postal: recado curto ("Oi, é da UNV, sobre a sua mensagem no WhatsApp. Te chamo por lá.") e encerre. Pessoa errada: peça desculpa e encerre. Já tem reunião marcada: só confirme presença e encerre. Lead irritado ou pedindo pra não ligar: peça desculpa, diga que não vai ligar de novo, chame marcar_perdido (tipo nao_quer) e encerre. Lead pede pra falar com uma pessoa: diga que o {{closer_primeiro_nome}} chama no WhatsApp hoje, chame anotar e encerre. Lead fora do perfil (sem empresa, buscando emprego, curioso): agradeça, chame marcar_fora_do_perfil e encerre sem marcar.`;

function toolsRetell() {
  const base = { type: "custom", url: `${FN_URL}?action=tool`, method: "POST", headers: { "x-voice-secret": VOICE_SECRET }, timeout_ms: 20000, speak_during_execution: true, speak_after_execution: true };
  const p = (props: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties: props, required });
  return [
    { ...base, name: "consultar_horarios", description: "Consulta horários livres na agenda do closer para uma data (YYYY-MM-DD). Use antes de oferecer qualquer horário.", parameters: p({ data: { type: "string", description: "Data no formato YYYY-MM-DD" } }, ["data"]) },
    { ...base, name: "agendar_reuniao", description: "Agenda a reunião no horário que o lead confirmou explicitamente e envia o convite.", parameters: p({ data_hora: { type: "string", description: "YYYY-MM-DDTHH:MM, horário de Brasília" }, titulo: { type: "string" }, email: { type: "string" }, telefone: { type: "string" }, nome_completo: { type: "string" }, empresa: { type: "string" }, nicho: { type: "string" } }, ["data_hora", "titulo"]) },
    { ...base, name: "salvar_dados_lead", description: "Guarda no CRM o que o lead contou: nicho, nome da empresa, Instagram da empresa.", parameters: p({ nicho: { type: "string" }, empresa: { type: "string" }, instagram_empresa: { type: "string" } }) },
    { ...base, name: "anotar", description: "Registra um recado curto para o closer no CRM (ex.: ligar de novo quinta às 14h).", parameters: p({ texto: { type: "string" } }, ["texto"]) },
    { ...base, name: "marcar_perdido", description: "Encerra o negócio no CRM quando o lead recusou claramente ou pediu para não ligar mais.", parameters: p({ motivo: { type: "string" }, tipo: { type: "string", enum: ["nao_quer", "timing", "preco", "concorrente", "outro"] } }, ["motivo", "tipo"]) },
    { ...base, name: "marcar_fora_do_perfil", description: "Use quando ficar claro que o lead não é do perfil (sem empresa, busca emprego, curioso, outro segmento).", parameters: p({ motivo: { type: "string" }, tipo: { type: "string", enum: ["iniciante_ou_faturamento_baixo", "sem_poder_de_decisao", "outro_segmento", "busca_emprego", "curioso_ou_concorrente", "outro"] } }, ["motivo", "tipo"]) },
    { type: "end_call", name: "encerrar_ligacao", description: "Encerra a ligação depois da despedida." },
  ];
}

async function setupRetell(body: any) {
  const prompt = (await setting<string>("voice_prompt", "")) || PROMPT_PADRAO;
  const beginMessage = (await setting<string>("voice_begin_message", "")) || "Oi, {{primeiro_nome}}? Tudo bem? Aqui é a assistente do {{closer_primeiro_nome}}, da UNV.";
  // voz: a escolhida no painel, senão a primeira feminina em português que a Retell tiver
  let voiceId = String(body.voice_id || (await setting<string>("retell_voice_id", "")) || "");
  const vozes: any[] = await retell("/list-voices");
  const ptBr = (v: any) => /brazil|brasil|portug/i.test(`${v.accent || ""} ${v.voice_name || ""}`);
  const candidatas = vozes.filter((v) => v.gender === "female" && ptBr(v)).sort((a, b) => (a.provider === "elevenlabs" ? -1 : 1) - (b.provider === "elevenlabs" ? -1 : 1));
  if (!voiceId) voiceId = candidatas[0]?.voice_id || vozes.find((v) => v.gender === "female" && v.provider === "elevenlabs")?.voice_id || vozes[0]?.voice_id;
  const llmBody = { general_prompt: prompt, begin_message: beginMessage, start_speaker: "agent", general_tools: toolsRetell(), model_temperature: 0.3 };
  let llmId = await setting<string>("retell_llm_id", "");
  if (llmId) { try { await retell(`/update-retell-llm/${llmId}`, "PATCH", llmBody); } catch { llmId = ""; } }
  if (!llmId) { llmId = (await retell("/create-retell-llm", "POST", llmBody)).llm_id; await setSetting("retell_llm_id", llmId); }
  const agentBody = {
    agent_name: "Assistente UNV (voz)", response_engine: { type: "retell-llm", llm_id: llmId }, voice_id: voiceId, voice_model: "eleven_flash_v2_5", language: "pt-BR",
    webhook_url: `${FN_URL}?action=webhook&secret=${encodeURIComponent(VOICE_SECRET)}`,
    enable_backchannel: true, backchannel_frequency: 0.6, backchannel_words: ["uhum", "tá", "certo", "entendi"],
    interruption_sensitivity: 0.7, responsiveness: 0.8, voicemail_option: { action: "hangup" },
    end_call_after_silence_ms: 20000, max_call_duration_ms: 480000, normalize_for_speech: true,
  };
  let agentId = await setting<string>("retell_agent_id", "");
  if (agentId) { try { await retell(`/update-agent/${agentId}`, "PATCH", agentBody); } catch { agentId = ""; } }
  if (!agentId) { agentId = (await retell("/create-agent", "POST", agentBody)).agent_id; await setSetting("retell_agent_id", agentId); }
  await setSetting("retell_voice_id", voiceId);
  const voz = vozes.find((v) => v.voice_id === voiceId);
  return { ok: true, llm_id: llmId, agent_id: agentId, voz: voz ? { id: voz.voice_id, nome: voz.voice_name, provedor: voz.provider, sotaque: voz.accent, preview: voz.preview_audio_url } : voiceId,
    outras_vozes: candidatas.slice(0, 8).map((v) => ({ id: v.voice_id, nome: v.voice_name, provedor: v.provider, sotaque: v.accent, preview: v.preview_audio_url })) };
}

// ---------- Twilio: tronco SIP + importar o número na Retell ----------
async function twilio(url: string, form?: Record<string, string>) {
  if (!TWILIO_SID || !TWILIO_TOKEN) throw new Error("Twilio não configurada");
  const r = await fetch(url, { method: form ? "POST" : "GET", headers: { Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`), ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: form ? new URLSearchParams(form) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Twilio ${url.split("/").slice(3, 6).join("/")}: ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}
async function setupTwilio(body: any) {
  const nums = (await twilio(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PageSize=50`)).incoming_phone_numbers || [];
  const lista = nums.map((n: any) => ({ sid: n.sid, numero: n.phone_number, nome: n.friendly_name, trunk: n.trunk_sid || null, voz_url: n.voice_url || null, app: n.voice_application_sid || null }));
  if (!body.phone_sid) return { ok: true, precisa: "informe phone_sid do número que vai ser da assistente (um que NÃO seja o do discador)", numeros: lista };
  const num = nums.find((n: any) => n.sid === body.phone_sid);
  if (!num) return { ok: false, error: "phone_sid não encontrado", numeros: lista };
  let trunkSid = await setting<string>("twilio_trunk_sid", "");
  let domain = await setting<string>("twilio_trunk_domain", "");
  const user = "retell"; let pass = await setting<string>("twilio_trunk_pass", "");
  if (!trunkSid) {
    domain = `unv-retell-${Math.random().toString(36).slice(2, 8)}.pstn.twilio.com`;
    const t = await twilio("https://trunking.twilio.com/v1/Trunks", { FriendlyName: "UNV Retell (assistente de voz)", DomainName: domain, TransferMode: "enable-all" });
    trunkSid = t.sid;
    pass = Math.random().toString(36).slice(2, 10) + "Aa1!" + Math.random().toString(36).slice(2, 8);
    const cl = await twilio(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/SIP/CredentialLists.json`, { FriendlyName: "UNV Retell" });
    await twilio(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/SIP/CredentialLists/${cl.sid}/Credentials.json`, { Username: user, Password: pass });
    await twilio(`https://trunking.twilio.com/v1/Trunks/${trunkSid}/CredentialLists`, { CredentialListSid: cl.sid });
    await twilio(`https://trunking.twilio.com/v1/Trunks/${trunkSid}/OriginationUrls`, { FriendlyName: "Retell", SipUrl: "sip:sip.retellai.com;transport=tcp", Priority: "10", Weight: "10", Enabled: "true" });
    await setSetting("twilio_trunk_sid", trunkSid); await setSetting("twilio_trunk_domain", domain); await setSetting("twilio_trunk_pass", pass);
  }
  if (num.trunk_sid !== trunkSid) await twilio(`https://trunking.twilio.com/v1/Trunks/${trunkSid}/PhoneNumbers`, { PhoneNumberSid: num.sid });
  const agentId = await setting<string>("retell_agent_id", "");
  const imp = await retell("/import-phone-number", "POST", {
    phone_number: num.phone_number, termination_uri: domain, sip_trunk_auth_username: user, sip_trunk_auth_password: pass, nickname: "UNV assistente de voz",
    ...(agentId ? { inbound_agents: [{ agent_id: agentId, weight: 1 }], outbound_agents: [{ agent_id: agentId, weight: 1 }] } : {}),
  }).catch((e) => ({ erro: String(e) }));
  await setSetting("retell_from_number", num.phone_number);
  return { ok: true, numero: num.phone_number, tronco: domain, retell: imp, aviso: "Na Twilio, em Voice → Geographic Permissions → Elastic SIP Trunking, o Brasil precisa estar liberado." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  const body = await req.json().catch(() => ({}));
  try {
    if (action === "tick") {
      if (!["service_role", "anon"].includes(papel(req)) && !autorizado(req, url)) return j({ error: "não autorizado" }, 403);
      return j(await tick(body.dry_run === true));
    }
    if (action === "tool" || action === "webhook" || action === "context") {
      if (!autorizado(req, url)) return j({ error: "não autorizado" }, 403);
      if (action === "tool") return j(await tool(body));
      if (action === "webhook") return j(await webhook(body));
      return j((await contexto(body.lead_id || null, body.phone || null)).vars);
    }
    // daqui pra baixo: equipe logada (ou service role)
    const staff = autorizado(req, url) ? { id: "", name: "sistema", role: "master" } : await staffDoToken(req);
    if (!staff) return j({ error: "sem permissão" }, 403);
    const admin = ["master", "admin"].includes(String(staff.role || ""));
    if (action === "start_call") return j(await startCall(String(body.lead_id || ""), "manual", staff.name));
    if (action === "status") {
      const chaves = ["voice_agent_enabled", "voice_pipeline_ids", "voice_no_reply_minutes", "voice_hours", "voice_max_calls_per_day", "voice_trigger_no_reply", "retell_agent_id", "retell_from_number", "retell_voice_id"];
      const { data: rows } = await sb.from("crm_settings").select("setting_key, setting_value").in("setting_key", chaves);
      const cfg: Record<string, unknown> = {}; (rows || []).forEach((r: any) => { cfg[r.setting_key] = r.setting_value; });
      const pronto = { retell_key: !!RETELL_API_KEY, agente: !!cfg.retell_agent_id, numero: !!cfg.retell_from_number, twilio: !!(TWILIO_SID && TWILIO_TOKEN) };
      let ligacoes: any[] = [];
      if (body.lead_id) ({ data: ligacoes } = await sb.from("crm_voice_calls").select("id, reason, status, started_at, duration_seconds, summary, disposition, recording_url, error, created_at").eq("lead_id", body.lead_id).order("created_at", { ascending: false }).limit(5) as any);
      return j({ cfg, pronto, ligacoes });
    }
    if (!admin) return j({ error: "só administrador" }, 403);
    if (action === "setup_retell") return j(await setupRetell(body));
    if (action === "setup_twilio") return j(await setupTwilio(body));
    if (action === "preview") return j(await tick(true));
    return j({ error: "ação desconhecida" }, 400);
  } catch (e) { return j({ error: String(e).slice(0, 400) }, 500); }
});
