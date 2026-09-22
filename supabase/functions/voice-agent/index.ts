// Assistente de VOZ (piloto, 22/09/2026): liga pro lead pela Retell (voz ElevenLabs) usando o
// mesmo cérebro do CRM. Nada liga enquanto crm_settings.voice_agent_enabled = false.
//   ?action=tick        cron 5/5 min: lead que chegou hoje e não respondeu no WhatsApp há N min → liga
//   ?action=start_call  { lead_id, reason }  (service role ou x-voice-secret)
//   ?action=context     { phone | lead_id } → variáveis dinâmicas da ligação
//   ?action=tool        webhook de função da Retell → roda a ferramenta do agente (agenda, CRM)
//   ?action=webhook     eventos da Retell (call_started / call_ended / call_analyzed)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VOICE_SECRET = Deno.env.get("VOICE_AGENT_SECRET") || "";
const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY") || "";
const RETELL_AGENT_ID = Deno.env.get("RETELL_AGENT_ID") || "";
const RETELL_FROM_NUMBER = Deno.env.get("RETELL_FROM_NUMBER") || "";
const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-voice-secret" };
const j = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const TZ = "America/Sao_Paulo";
const digits = (p: string) => (p || "").replace(/\D/g, "");
const e164 = (p: string) => { const d = digits(p); if (!d) return ""; return "+" + (d.startsWith("55") && d.length >= 12 ? d : `55${d}`); };
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...o }).format(d);

async function setting<T>(key: string, def: T): Promise<T> {
  const { data } = await sb.from("crm_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  return (data?.setting_value ?? def) as T;
}
function papel(req: Request): string {
  try { const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); return String(JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role || ""); } catch { return ""; }
}
function autorizado(req: Request, url: URL): boolean {
  if (VOICE_SECRET && (req.headers.get("x-voice-secret") === VOICE_SECRET || url.searchParams.get("secret") === VOICE_SECRET)) return true;
  return papel(req) === "service_role";
}
function dentroDoHorario(faixa: string): boolean {
  const [ini, fim] = String(faixa || "09:00-19:00").split("-");
  const agora = new Date(); const dow = new Date(agora.toLocaleString("en-US", { timeZone: TZ })).getDay();
  if (dow === 0 || dow === 6) return false;
  const hm = fmt(agora, { hour: "2-digit", minute: "2-digit", hour12: false });
  return hm >= ini && hm <= fim;
}

// ---------- contexto do lead (vira variável dinâmica na Retell) ----------
async function contexto(leadId: string | null, phone: string | null) {
  const campos = "id, name, company, phone, email, segment, origin, notes, owner_staff_id, closer_staff_id, stage_id, pipeline_id, created_at";
  let lead: any = null;
  if (leadId) ({ data: lead } = await sb.from("crm_leads").select(campos).eq("id", leadId).maybeSingle());
  if (!lead && phone) {
    const { data: id } = await sb.rpc("crm_find_lead_by_phone", { p_phone: phone });
    if (id) ({ data: lead } = await sb.from("crm_leads").select(campos).eq("id", id).maybeSingle());
  }
  if (!lead) return { lead: null, vars: { nome: "", primeiro_nome: "", empresa: "", origem: "", historico: "", closer: "", reuniao: "" } };
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

// ---------- disparar ligação ----------
async function startCall(leadId: string, reason: string) {
  const { lead, vars } = await contexto(leadId, null);
  if (!lead) return { ok: false, error: "lead não encontrado" };
  const to = e164(lead.phone || "");
  if (!to || to.length < 13) return { ok: false, error: "lead sem celular válido" };
  const { data: row } = await sb.from("crm_voice_calls").insert({ lead_id: lead.id, phone: to, reason, dynamic_vars: vars, status: "queued" }).select("id").single();
  if (!RETELL_API_KEY || !RETELL_AGENT_ID || !RETELL_FROM_NUMBER) {
    await sb.from("crm_voice_calls").update({ status: "skipped", error: "Retell não configurada (RETELL_API_KEY / RETELL_AGENT_ID / RETELL_FROM_NUMBER)" }).eq("id", row!.id);
    return { ok: false, error: "Retell não configurada", call_id: row!.id };
  }
  const r = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST", headers: { Authorization: `Bearer ${RETELL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from_number: RETELL_FROM_NUMBER, to_number: to, override_agent_id: RETELL_AGENT_ID,
      retell_llm_dynamic_variables: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v ?? "")])),
      metadata: { lead_id: lead.id, call_row_id: row!.id, reason },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { await sb.from("crm_voice_calls").update({ status: "failed", error: `Retell ${r.status}: ${JSON.stringify(d).slice(0, 200)}` }).eq("id", row!.id); return { ok: false, error: d, call_id: row!.id }; }
  await sb.from("crm_voice_calls").update({ status: "dialing", provider_call_id: d.call_id, started_at: new Date().toISOString() }).eq("id", row!.id);
  return { ok: true, call_id: row!.id, retell_call_id: d.call_id };
}

// ---------- vigia: lead novo sem resposta no WhatsApp ----------
async function tick(dry: boolean) {
  const enabled = await setting<boolean>("voice_agent_enabled", false);
  if (!enabled && !dry) return { skipped: "voice_agent_enabled = false" };
  if (!dentroDoHorario(await setting<string>("voice_hours", "09:00-19:00"))) return { skipped: "fora do horário" };
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
    .select("id, lead_id, last_message_at, last_inbound_at, created_at, lead:crm_leads(id, name, phone, created_at)")
    .eq("last_message_direction", "outbound").not("lead_id", "is", null)
    .gte("created_at", inicioHoje)
    .lte("last_message_at", limite).gte("last_message_at", desde).limit(100);
  const saida: any[] = [];
  for (const c of (convs || []) as any[]) {
    const lead = c.lead; if (!lead?.phone) continue;
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
  if (!row && ev === "call_started") { // ligação recebida (inbound) sem registro
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
    if (call.call_cost?.combined_cost != null) upd.cost_cents = Math.round(Number(call.call_cost.combined_cost)); // já vem em centavos de dólar
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
    if (!autorizado(req, url)) return j({ error: "não autorizado" }, 403);
    if (action === "start_call") return j(await startCall(String(body.lead_id || ""), String(body.reason || "manual")));
    if (action === "context") return j((await contexto(body.lead_id || null, body.phone || null)).vars);
    if (action === "tool") return j(await tool(body));
    if (action === "webhook") return j(await webhook(body));
    return j({ error: "ação desconhecida" }, 400);
  } catch (e) { return j({ error: String(e).slice(0, 300) }, 500); }
});
