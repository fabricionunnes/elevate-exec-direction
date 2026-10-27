// ai-team-orchestrator: o "Max" — coordenador do Time de IA da empresa.
// Decide quais especialistas rodam agora, executa cada um, grava a rodada em
// ai_team_runs, deixa anúncios/posts/mensagens na fila ai_team_approvals e
// fecha com um briefing único pro dono (opcionalmente no WhatsApp).
//
// Modos (body):
//   {scheduled:true}                 -> CRON (30/30 min): roda os agentes cujo horário bate com o slot
//                                        atual (BRT) e ainda não rodaram hoje. Exige service role.
//   {companyId}                      -> MANUAL: roda todos os especialistas rodáveis da empresa agora.
//   {companyId, agentKey}            -> MANUAL: roda só aquele agente.
// Chamada manual exige JWT de alguém com acesso à empresa (cliente ou staff).
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = Deno.env.get("AI_TEAM_MODEL") || "claude-haiku-4-5";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type AgentKey = "orquestrador" | "atendimento" | "briefing" | "anuncios" | "conteudo" | "reativacao" | "trafego" | "qualificacao";
type Agent = { id: string; agent_key: AgentKey; name: string; role_title: string; is_active: boolean; schedule: { hour?: string; days?: number[] } | null; config: Record<string, any> };
type Company = { id: string; name: string; segment: string | null; phone: string | null };
type RunResult = { status: "done" | "skipped" | "error"; summary: string; output?: any; approvals?: { kind: string; title: string; payload: any }[] };

// Agentes que trabalham por rodada. Os outros (atendimento, tráfego, qualificação)
// são de canal: agem quando chega mensagem/lead, não quando o Max chama.
const RUNNABLE: AgentKey[] = ["briefing", "anuncios", "conteudo", "reativacao"];
const CHANNEL_NOTE: Partial<Record<AgentKey, string>> = {
  atendimento: "Agente de canal: responde quando chega Direct ou WhatsApp no CRM, não em rodada.",
  trafego: "Agente de canal: lê as campanhas sincronizadas da Meta; sem campanha conectada, não tem o que analisar.",
  qualificacao: "Agente de canal: pontua cada lead na entrada do CRM, não em rodada.",
};

// ── horário de Brasília ──
function brNow(): Date { return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })); }
function brToday(): string {
  const d = brNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function brNowSlot(): string {
  const d = brNow();
  let h = d.getHours();
  const min = d.getMinutes();
  let m = 0;
  if (min >= 15 && min < 45) m = 30;
  else if (min >= 45) { m = 0; h = (h + 1) % 24; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function daysAgo(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Papel (claim "role") de um JWT já validado pelo gateway; "" se não der pra ler. */
function jwtRole(token: string): string {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return String(JSON.parse(atob(payload))?.role || "");
  } catch { return ""; }
}

/** medidor de tokens (fire-and-forget), mesmo padrão das outras funções */
function logUsoIA(fn: string, usage: any, meta?: Record<string, unknown>) {
  try {
    fetch(`${SUPABASE_URL}/rest/v1/ai_usage_log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        fn, model: MODEL,
        input_tokens: usage?.input_tokens ?? 0,
        output_tokens: usage?.output_tokens ?? 0,
        cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
        cache_write_tokens: usage?.cache_creation_input_tokens ?? 0,
        meta: meta ?? null,
      }),
    }).catch(() => {});
  } catch { /* medidor nunca derruba a função */ }
}

async function askClaude(prompt: string, opts: { maxTokens?: number; temperature?: number; agent: string } ): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada");
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, max_tokens: opts.maxTokens ?? 1200, temperature: opts.temperature ?? 0.8,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Claude ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  logUsoIA("ai-team-orchestrator", data?.usage, { agent: opts.agent });
  return (data?.content?.[0]?.text || "").trim();
}

/** Extrai o primeiro JSON (objeto ou array) de uma resposta da IA. */
function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = Math.min(...["{", "["].map((c) => { const i = cleaned.indexOf(c); return i < 0 ? Infinity : i; }));
  if (!Number.isFinite(start)) throw new Error("IA não devolveu JSON");
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

/** Envia texto pela instância padrão (mesma lógica do resumo-diario-gestao). */
async function sendWhatsApp(supabase: SupabaseClient, number: string, text: string): Promise<boolean> {
  try {
    let { data: inst } = await supabase
      .from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type")
      .eq("instance_name", "fabricionunnes").eq("status", "connected").maybeSingle();
    if (!inst) {
      const { data: fb } = await supabase
        .from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type")
        .eq("status", "connected").limit(1).maybeSingle();
      inst = fb;
    }
    if (!inst?.api_url || !inst?.api_key) return false;
    let host = "";
    try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* noop */ }
    const isV2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
    const url = isV2
      ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text`
      : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: inst.api_key },
      body: JSON.stringify({ number, text }),
    });
    return resp.ok;
  } catch { return false; }
}

function companyContext(c: Company, cfg: Record<string, any>): string {
  const lines = [`Empresa: ${c.name}`];
  if (c.segment) lines.push(`Segmento: ${c.segment}`);
  if (cfg.oferta) lines.push(`Oferta principal: ${cfg.oferta}`);
  if (cfg.publico) lines.push(`Público-alvo: ${cfg.publico}`);
  if (cfg.tom) lines.push(`Tom de voz da marca: ${cfg.tom}`);
  return lines.join("\n");
}

// ───────────────────────── especialistas ─────────────────────────

/** Bia — resumo diário: KPIs de ontem vs média 7d + fila de aprovação. */
async function runBriefing(supabase: SupabaseClient, c: Company, agent: Agent, pendingApprovals: number): Promise<RunResult> {
  const today = brToday();
  const isMonday = new Date(today + "T12:00:00").getDay() === 1;
  const ref = daysAgo(today, isMonday ? 2 : 1);
  const refLabel = isMonday ? "sábado" : "ontem";

  const { data: kpis } = await supabase.from("company_kpis").select("id, name, kpi_type").eq("company_id", c.id).eq("is_active", true);
  const { data: entries } = await supabase.from("kpi_entries").select("kpi_id, entry_date, value")
    .eq("company_id", c.id).gte("entry_date", daysAgo(ref, 7)).lte("entry_date", ref);

  const rows: string[] = [];
  for (const k of (kpis || []) as any[]) {
    const mine = ((entries || []) as any[]).filter((e) => e.kpi_id === k.id);
    const refTotal = mine.filter((e) => e.entry_date === ref).reduce((s, e) => s + Number(e.value || 0), 0);
    const prev = mine.filter((e) => e.entry_date !== ref);
    const prevDays = new Set(prev.map((e) => e.entry_date)).size;
    const avg = prevDays ? prev.reduce((s, e) => s + Number(e.value || 0), 0) / prevDays : 0;
    const fmt = (n: number) => k.kpi_type === "monetary" ? brl(n) : String(Math.round(n * 10) / 10);
    const delta = avg > 0 ? `${refTotal >= avg ? "+" : ""}${Math.round(((refTotal - avg) / avg) * 100)}% vs média` : "sem base";
    if (mine.length) rows.push(`- ${k.name}: ${refLabel} ${fmt(refTotal)} (média 7d ${fmt(avg)}, ${delta})`);
  }

  const semDados = rows.length === 0;
  const prompt = `Você é ${agent.name}, responsável pelo resumo diário no Time de IA da empresa ${c.name}. Escreva o briefing da manhã pro dono da empresa.

${semDados ? `Nenhum indicador foi lançado ${refLabel}. Cobre o lançamento com firmeza e explique que sem número você não consegue devolver leitura.` : `Números de ${refLabel} (vs média diária dos 7 dias anteriores):\n${rows.join("\n")}`}
${pendingApprovals > 0 ? `\nHá ${pendingApprovals} item(ns) do time esperando aprovação do dono na tela do Time de IA.` : ""}

Regras: 5 a 7 linhas, português do Brasil, direto, sem emoji, sem markdown. Destaque 1 ponto de atenção ou 1 vitória. Feche com 1 ação concreta pra HOJE. Não invente número.`;
  const text = await askClaude(prompt, { maxTokens: 500, agent: "briefing" });
  return { status: "done", summary: text, output: { ref, rows, pendingApprovals } };
}

/** Rafa — 3 anúncios pra aprovação (copy, CTA, público, ângulo). */
async function runAnuncios(c: Company, agent: Agent): Promise<RunResult> {
  const prompt = `Você é ${agent.name}, criador de anúncios do Time de IA. Crie 3 anúncios Meta Ads (Instagram/Facebook) diferentes entre si para a empresa abaixo.

${companyContext(c, agent.config)}

Cada anúncio com ângulo distinto (dor, prova/autoridade, oferta direta). Responda SOMENTE com JSON:
[{"angulo":"...","headline":"até 40 caracteres","texto":"texto principal de 3 a 5 linhas, sem emoji","cta":"ex: Saiba mais","publico":"descrição curta do público e interesses"}]`;
  const ads = parseJson<{ angulo: string; headline: string; texto: string; cta: string; publico: string }[]>(
    await askClaude(prompt, { maxTokens: 1400, agent: "anuncios" }),
  );
  const approvals = ads.slice(0, 3).map((ad) => ({ kind: "ad", title: ad.headline, payload: ad }));
  return { status: "done", summary: `Deixei ${approvals.length} anúncios prontos pra você aprovar.`, output: { ads }, approvals };
}

/** Nina — 3 posts (gancho, legenda, formato) pra aprovação. */
async function runConteudo(c: Company, agent: Agent): Promise<RunResult> {
  const prompt = `Você é ${agent.name}, responsável por conteúdo e social no Time de IA. Proponha 3 posts pro Instagram da empresa abaixo, pensados pra gerar conversa com cliente (não só curtida).

${companyContext(c, agent.config)}

Responda SOMENTE com JSON:
[{"formato":"reels|carrossel|estático","gancho":"primeira frase que segura a atenção","legenda":"legenda completa, sem emoji, com CTA no final","objetivo":"o que esse post deve gerar"}]`;
  const posts = parseJson<{ formato: string; gancho: string; legenda: string; objetivo: string }[]>(
    await askClaude(prompt, { maxTokens: 1400, agent: "conteudo" }),
  );
  const approvals = posts.slice(0, 3).map((p) => ({ kind: "post", title: p.gancho, payload: p }));
  return { status: "done", summary: `Separei ${approvals.length} posts pra semana, é só aprovar.`, output: { posts }, approvals };
}

/** Theo — mensagens de reativação pra clientes/leads parados. */
async function runReativacao(c: Company, agent: Agent): Promise<RunResult> {
  const prompt = `Você é ${agent.name}, responsável por reativação no Time de IA. Escreva 3 mensagens de WhatsApp pra reativar contatos parados da empresa abaixo: uma pra cliente antigo que sumiu, uma pra lead que pediu orçamento e não fechou, uma pra quem comprou uma vez e não voltou.

${companyContext(c, agent.config)}

Regras: tom humano, como o dono escreveria, sem emoji, 3 a 4 linhas cada, termina com pergunta fácil de responder. Use {{nome}} no lugar do nome. Responda SOMENTE com JSON:
[{"alvo":"...","mensagem":"..."}]`;
  const msgs = parseJson<{ alvo: string; mensagem: string }[]>(
    await askClaude(prompt, { maxTokens: 900, agent: "reativacao" }),
  );
  const approvals = msgs.slice(0, 3).map((m) => ({ kind: "message", title: `Reativação: ${m.alvo}`, payload: m }));
  return { status: "done", summary: `Montei ${approvals.length} mensagens de reativação pra você disparar.`, output: { msgs }, approvals };
}

async function runAgent(supabase: SupabaseClient, c: Company, agent: Agent, pendingApprovals: number): Promise<RunResult> {
  switch (agent.agent_key) {
    case "briefing": return runBriefing(supabase, c, agent, pendingApprovals);
    case "anuncios": return runAnuncios(c, agent);
    case "conteudo": return runConteudo(c, agent);
    case "reativacao": return runReativacao(c, agent);
    default: return { status: "skipped", summary: CHANNEL_NOTE[agent.agent_key] || "Agente sem rodada." };
  }
}

// ───────────────────────── Max (orquestrador) ─────────────────────────

async function orchestrate(
  supabase: SupabaseClient, c: Company, agents: Agent[],
  opts: { trigger: "manual" | "cron"; only?: AgentKey | null },
) {
  const today = brToday();
  const slot = brNowSlot();
  const dow = brNow().getDay();
  const byKey = new Map(agents.map((a) => [a.agent_key, a]));
  const max = byKey.get("orquestrador");

  // quem roda agora
  const { data: todayRuns } = await supabase.from("ai_team_runs").select("agent_key")
    .eq("company_id", c.id).eq("status", "done").gte("started_at", `${today}T00:00:00-03:00`);
  const ranToday = new Set(((todayRuns || []) as any[]).map((r) => r.agent_key));

  const selected = agents.filter((a) => {
    if (a.agent_key === "orquestrador" || !a.is_active) return false;
    if (opts.only) return a.agent_key === opts.only;
    if (opts.trigger === "manual") return RUNNABLE.includes(a.agent_key);
    if (!a.schedule?.hour) return false;
    if (a.schedule.hour !== slot) return false;
    if (a.schedule.days?.length && !a.schedule.days.includes(dow)) return false;
    return !ranToday.has(a.agent_key);
  });
  if (!selected.length) return { company: c.name, ran: [], skipped: "nada agendado pra este horário" };

  const { data: maxRun } = await supabase.from("ai_team_runs")
    .insert({ company_id: c.id, agent_key: "orquestrador", trigger: opts.trigger, status: "running" }).select("id").single();

  const { count: pendingCount } = await supabase.from("ai_team_approvals")
    .select("id", { count: "exact", head: true }).eq("company_id", c.id).eq("status", "pending");

  const results: { agent: Agent; result: RunResult }[] = [];
  for (const agent of selected) {
    const { data: run } = await supabase.from("ai_team_runs")
      .insert({ company_id: c.id, agent_key: agent.agent_key, trigger: opts.trigger, status: "running" }).select("id").single();
    let result: RunResult;
    try {
      result = await runAgent(supabase, c, agent, pendingCount || 0);
    } catch (e) {
      result = { status: "error", summary: `Falhou: ${(e as Error).message}` };
    }
    if (result.approvals?.length) {
      await supabase.from("ai_team_approvals").insert(result.approvals.map((ap) => ({
        company_id: c.id, agent_key: agent.agent_key, run_id: run?.id, kind: ap.kind, title: ap.title, payload: ap.payload,
      })));
    }
    await supabase.from("ai_team_runs").update({
      status: result.status, summary: result.summary, output: result.output ?? null,
      error: result.status === "error" ? result.summary : null, finished_at: new Date().toISOString(),
    }).eq("id", run?.id);
    if (result.status === "done") {
      await supabase.from("ai_team_agents").update({ last_run_at: new Date().toISOString() }).eq("id", agent.id);
    }
    results.push({ agent, result });
  }

  // briefing do Max: consolida a rodada em poucas linhas pro dono
  const novasAprovacoes = results.reduce((s, r) => s + (r.result.approvals?.length || 0), 0);
  const relato = results.map((r) => `- ${r.agent.name} (${r.agent.role_title}): [${r.result.status}] ${r.result.summary.slice(0, 400)}`).join("\n");
  let maxText = "";
  try {
    maxText = await askClaude(`Você é ${max?.name || "Max"}, coordenador do Time de IA da empresa ${c.name}. O time acabou de rodar. Escreva o recado pro dono: o que cada um entregou e o que está esperando a decisão dele.

Rodada:
${relato}
${novasAprovacoes ? `\n${novasAprovacoes} item(ns) novos entraram na fila de aprovação.` : ""}

Regras: 3 a 5 linhas, português do Brasil, direto, sem emoji, sem markdown, sem repetir o texto dos agentes na íntegra. Se algo falhou, diga sem rodeio.`, { maxTokens: 400, agent: "orquestrador" });
  } catch (e) {
    maxText = `Rodada concluída: ${results.map((r) => `${r.agent.name} ${r.result.status}`).join(", ")}. (${(e as Error).message})`;
  }

  let whatsapp: boolean | null = null;
  if (max?.config?.send_whatsapp && c.phone) {
    const number = c.phone.replace(/\D/g, "");
    whatsapp = await sendWhatsApp(supabase, number.startsWith("55") ? number : `55${number}`, `*Time de IA · ${c.name}*\n\n${maxText}`);
  }

  await supabase.from("ai_team_runs").update({
    status: "done", summary: maxText, finished_at: new Date().toISOString(),
    output: { ran: results.map((r) => ({ agent: r.agent.agent_key, status: r.result.status })), novasAprovacoes, whatsapp },
  }).eq("id", maxRun?.id);
  if (max) await supabase.from("ai_team_agents").update({ last_run_at: new Date().toISOString() }).eq("id", max.id);

  return { company: c.name, ran: results.map((r) => ({ agent: r.agent.agent_key, status: r.result.status })), novasAprovacoes, whatsapp };
}

// ───────────────────────── handler ─────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    let companyIds: string[] = [];
    let trigger: "manual" | "cron" = "manual";

    if (body.scheduled === true) {
      // cron do projeto chama com a anon key (padrão dos outros crons); service role também vale.
      // O gateway já validou a assinatura do JWT (verify_jwt), então basta olhar o papel.
      // Modo agendado é idempotente (1 rodada por agente/dia), então não há o que abusar.
      if (!["anon", "service_role"].includes(jwtRole(token))) return json({ error: "cron exige chave do projeto" }, 401);
      trigger = "cron";
      const { data } = await supabase.from("ai_team_agents").select("company_id")
        .eq("agent_key", "orquestrador").eq("is_active", true);
      companyIds = Array.from(new Set(((data || []) as any[]).map((r) => r.company_id)));
    } else {
      if (!body.companyId) return json({ error: "companyId obrigatório" }, 400);
      // quem chama precisa ter acesso à empresa (cliente ou staff) — checado com o JWT do próprio usuário
      // (apikey = service role só pra passar no gateway; o Authorization do usuário é o que manda no RLS)
      const asUser = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await asUser.auth.getUser(token);
      if (!user) return json({ error: "não autenticado" }, 401);
      const [cli, staff] = await Promise.all([
        asUser.rpc("client_has_company_access", { check_company_id: body.companyId }),
        asUser.rpc("staff_has_company_access", { check_company_id: body.companyId }),
      ]);
      if (!cli.data && !staff.data) return json({ error: "sem acesso à empresa" }, 403);
      companyIds = [body.companyId];
    }

    const results: any[] = [];
    for (const companyId of companyIds) {
      const { data: c } = await supabase.from("onboarding_companies").select("id, name, segment, phone").eq("id", companyId).maybeSingle();
      if (!c) continue;
      const { data: agents } = await supabase.from("ai_team_agents").select("*").eq("company_id", companyId);
      if (!agents?.length) { results.push({ company: c.name, skipped: "time não montado" }); continue; }
      results.push(await orchestrate(supabase, c as Company, agents as Agent[], { trigger, only: body.agentKey || null }));
    }
    return json({ ok: true, trigger, slot: brNowSlot(), results });
  } catch (e) {
    console.error("ai-team-orchestrator", e);
    return json({ error: (e as Error).message }, 500);
  }
});
