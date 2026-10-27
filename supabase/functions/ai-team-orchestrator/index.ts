// ai-team-orchestrator: o "Max" — coordenador do Time de IA da empresa.
// Decide quais especialistas rodam agora, executa cada um, grava a rodada em
// ai_team_runs, deixa anúncios/posts/mensagens na fila ai_team_approvals e
// fecha com um briefing único pro dono (opcionalmente no WhatsApp).
//
// Modos (body):
//   {scheduled:true}                 -> CRON (30/30 min): roda os agentes cujo horário bate com o slot
//                                        atual (BRT) e ainda não rodaram hoje. Exige anon/service role.
//   {companyId}                      -> MANUAL: roda todos os especialistas rodáveis da empresa agora.
//   {companyId, agentKey}            -> MANUAL: roda só aquele agente.
// Chamada manual exige JWT de alguém com acesso à empresa (cliente ou staff) ou a service role.
//
// Dados: cada agente recebe um "contexto" montado em buildContext(). Por padrão só KPIs
// (company_kpis/kpi_entries). Com config.dados = "nexus_unv" no orquestrador, o contexto
// vem do próprio Nexus da UNV: CRM (tenant null), faturas, contas a pagar, carteira/churn,
// health score, NPS, Meta Ads (crm_meta_ads_*) e catálogo de serviços.
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

// Agentes que trabalham por rodada. Lia (atendimento) é de canal: age quando chega mensagem.
const RUNNABLE: AgentKey[] = ["briefing", "anuncios", "conteudo", "reativacao", "trafego", "qualificacao"];
const CHANNEL_NOTE: Partial<Record<AgentKey, string>> = {
  atendimento: "Agente de canal: responde quando chega Direct ou WhatsApp no CRM, não em rodada.",
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
const brl = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

// ───────────────────────── contexto (dados reais) ─────────────────────────

type StaleLead = { id: string; name: string; pipeline: string; stage: string; dias: number; valor: number; origem: string | null };
type Ctx = {
  modo: "kpis" | "nexus_unv";
  empresa: string;
  oferta: string;              // texto de oferta/público/tom (config)
  kpis: string;                // bloco de KPIs lançados (modo kpis)
  comercial: string;           // CRM: leads, ganhos, perdidos, reuniões
  financeiro: string;          // faturas + contas a pagar
  carteira: string;            // clientes ativos, churn, health, NPS
  trafego: string;             // Meta Ads
  catalogo: string;            // serviços e preços
  leadsParados: StaleLead[];   // pra reativação
  clientesPerdidos: { nome: string; mes: string; motivo: string }[];
  leadsNovos: { id: string; name: string; pipeline: string; origem: string | null; horas: number; semDono: boolean; semAtividade: boolean }[];
  campanhas: { nome: string; gasto: number; leads: number; cpl: number | null }[];
};

const num = (v: any) => Number(v || 0);
const pct = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "sem base");

function ofertaBlock(c: Company, cfg: Record<string, any>): string {
  const lines = [`Empresa: ${c.name}`];
  if (c.segment) lines.push(`Segmento: ${c.segment}`);
  if (cfg.oferta) lines.push(`Oferta principal: ${cfg.oferta}`);
  if (cfg.publico) lines.push(`Público-alvo: ${cfg.publico}`);
  if (cfg.tom) lines.push(`Tom de voz da marca: ${cfg.tom}`);
  return lines.join("\n");
}

/** Bloco de KPIs lançados (company_kpis/kpi_entries) — vale pra qualquer empresa. */
async function kpiBlock(supabase: SupabaseClient, companyId: string): Promise<string> {
  const today = brToday();
  const isMonday = new Date(today + "T12:00:00").getDay() === 1;
  const ref = daysAgo(today, isMonday ? 2 : 1);
  const refLabel = isMonday ? "sábado" : "ontem";
  const { data: kpis } = await supabase.from("company_kpis").select("id, name, kpi_type").eq("company_id", companyId).eq("is_active", true);
  if (!kpis?.length) return "";
  const { data: entries } = await supabase.from("kpi_entries").select("kpi_id, entry_date, value")
    .eq("company_id", companyId).gte("entry_date", daysAgo(ref, 7)).lte("entry_date", ref);
  const rows: string[] = [];
  for (const k of kpis as any[]) {
    const mine = ((entries || []) as any[]).filter((e) => e.kpi_id === k.id);
    if (!mine.length) continue;
    const refTotal = mine.filter((e) => e.entry_date === ref).reduce((s, e) => s + num(e.value), 0);
    const prev = mine.filter((e) => e.entry_date !== ref);
    const prevDays = new Set(prev.map((e) => e.entry_date)).size;
    const avg = prevDays ? prev.reduce((s, e) => s + num(e.value), 0) / prevDays : 0;
    const fmt = (n: number) => k.kpi_type === "monetary" ? brl(n) : String(Math.round(n * 10) / 10);
    rows.push(`- ${k.name}: ${refLabel} ${fmt(refTotal)} (média 7d ${fmt(avg)}, ${pct(refTotal, avg)})`);
  }
  return rows.length ? `KPIs lançados (${refLabel} vs média diária dos 7 dias anteriores):\n${rows.join("\n")}` : `Nenhum KPI lançado ${refLabel}.`;
}

/** Contexto completo da UNV lido do próprio Nexus (CRM tenant null, financeiro, carteira, Meta, catálogo). */
async function unvContext(supabase: SupabaseClient, ctx: Ctx): Promise<void> {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const d7 = iso(new Date(now.getTime() - 7 * 864e5));
  const d30 = iso(new Date(now.getTime() - 30 * 864e5));
  const d90 = iso(new Date(now.getTime() - 90 * 864e5));
  const today = brToday();
  const monthStart = today.slice(0, 8) + "01";
  const prevMonthStart = daysAgo(monthStart, 1).slice(0, 8) + "01";
  const nextMonthStart = (() => { const d = new Date(monthStart + "T12:00:00"); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })();
  const nextMonthEnd = (() => { const d = new Date(nextMonthStart + "T12:00:00"); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })();

  // ── CRM (tenant null = CRM da própria UNV) ──
  const { data: pipelines } = await supabase.from("crm_pipelines").select("id, name").is("tenant_id", null);
  const pipeName = new Map((pipelines || []).map((p: any) => [p.id, p.name]));
  const { data: stages } = await supabase.from("crm_stages").select("id, name, is_final, final_type").is("tenant_id", null);
  const stageInfo = new Map((stages || []).map((s: any) => [s.id, s]));

  const { data: novos30 } = await supabase.from("crm_leads")
    .select("id, name, pipeline_id, stage_id, origin, owner_staff_id, created_at, last_activity_at, campaign_name, ad_name")
    .is("tenant_id", null).gte("created_at", d30).limit(3000);
  const leads30 = (novos30 || []) as any[];
  const leads7 = leads30.filter((l) => l.created_at >= d7);
  const byPipe = (arr: any[]) => {
    const m = new Map<string, number>();
    for (const l of arr) { const n = pipeName.get(l.pipeline_id) || "sem funil"; m.set(n, (m.get(n) || 0) + 1); }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n} ${c}`).join(", ");
  };

  const { data: finais } = await supabase.from("crm_leads")
    .select("id, name, stage_id, pipeline_id, opportunity_value, stage_entered_at")
    .is("tenant_id", null).gte("stage_entered_at", d30).limit(3000);
  let ganhos = 0, ganhosValor = 0, perdidos = 0;
  const ganhosNomes: string[] = [];
  for (const l of (finais || []) as any[]) {
    const s = stageInfo.get(l.stage_id);
    if (!s?.is_final) continue;
    if (s.final_type === "won") { ganhos++; ganhosValor += num(l.opportunity_value); if (ganhosNomes.length < 5) ganhosNomes.push(`${l.name} (${pipeName.get(l.pipeline_id) || "?"})`); }
    else if (s.final_type === "lost") perdidos++;
  }

  const { data: acts } = await supabase.from("crm_activities").select("type, status, scheduled_at, lead_id")
    .eq("type", "meeting").gte("scheduled_at", d30).limit(2000);
  const leadIds30 = new Set(leads30.map((l) => l.id));
  const meetings = ((acts || []) as any[]);
  const m7 = meetings.filter((a) => a.scheduled_at >= d7);
  const cnt = (arr: any[], st: string) => arr.filter((a) => a.status === st).length;
  void leadIds30;

  ctx.comercial = [
    `Leads novos: ${leads7.length} nos últimos 7 dias (${byPipe(leads7) || "nenhum"}); ${leads30.length} nos últimos 30 dias (${byPipe(leads30)}).`,
    `Fechamentos (30d): ${ganhos} ganhos somando ${brl(ganhosValor)}${ganhosNomes.length ? ` — ${ganhosNomes.join("; ")}` : ""}; ${perdidos} perdidos.`,
    `Reuniões: 7d → ${cnt(m7, "completed")} realizadas, ${cnt(m7, "cancelled")} canceladas, ${cnt(m7, "pending")} marcadas; 30d → ${cnt(meetings, "completed")} realizadas, ${cnt(meetings, "cancelled")} canceladas.`,
  ].join("\n");

  // origem dos leads (campanha/anúncio) 30d
  const camp = new Map<string, number>();
  for (const l of leads30) { const k = l.campaign_name || l.origin; if (k) camp.set(k, (camp.get(k) || 0) + 1); }
  const topOrigens = Array.from(camp.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (topOrigens.length) ctx.comercial += `\nOrigens que mais trouxeram lead (30d): ${topOrigens.map(([k, v]) => `${k} ${v}`).join(", ")}.`;

  // leads parados: >30d sem atividade, fora de etapa final, com nome
  const { data: parados } = await supabase.from("crm_leads")
    .select("id, name, pipeline_id, stage_id, last_activity_at, opportunity_value, origin, loss_reason_id")
    .is("tenant_id", null).is("loss_reason_id", null).lt("last_activity_at", d30).gte("last_activity_at", d90)
    .order("opportunity_value", { ascending: false, nullsFirst: false }).limit(400);
  ctx.leadsParados = ((parados || []) as any[])
    .filter((l) => l.name && !stageInfo.get(l.stage_id)?.is_final)
    .slice(0, 12)
    .map((l) => ({
      id: l.id, name: l.name, pipeline: pipeName.get(l.pipeline_id) || "?", stage: stageInfo.get(l.stage_id)?.name || "?",
      dias: Math.round((now.getTime() - new Date(l.last_activity_at).getTime()) / 864e5), valor: num(l.opportunity_value), origem: l.origin,
    }));
  const totalParados = ((parados || []) as any[]).filter((l) => !stageInfo.get(l.stage_id)?.is_final).length;
  ctx.comercial += `\nLeads parados (30 a 90 dias sem atividade, fora de etapa final): ${totalParados}.`;

  // leads novos sem dono / sem atividade (24h) — qualificação
  const d1 = iso(new Date(now.getTime() - 864e5));
  ctx.leadsNovos = leads30.filter((l) => l.created_at >= d1).slice(0, 30).map((l) => ({
    id: l.id, name: l.name || "(sem nome)", pipeline: pipeName.get(l.pipeline_id) || "?", origem: l.campaign_name || l.origin || null,
    horas: Math.round((now.getTime() - new Date(l.created_at).getTime()) / 36e5),
    semDono: !l.owner_staff_id, semAtividade: !l.last_activity_at || l.last_activity_at <= l.created_at,
  }));

  // ── Financeiro ──
  const { data: inv } = await supabase.from("company_invoices").select("status, amount_cents, due_date, paid_at")
    .gte("due_date", prevMonthStart).lt("due_date", nextMonthEnd).limit(2000);
  const invs = (inv || []) as any[];
  const sum = (arr: any[]) => arr.reduce((s, i) => s + num(i.amount_cents) / 100, 0);
  const mesAtual = invs.filter((i) => i.due_date >= monthStart && i.due_date < nextMonthStart);
  const mesAnt = invs.filter((i) => i.due_date >= prevMonthStart && i.due_date < monthStart);
  const prox = invs.filter((i) => i.due_date >= nextMonthStart);
  const pago = (arr: any[]) => arr.filter((i) => i.status === "paid");
  const { data: pay } = await supabase.from("financial_payables").select("status, amount, due_date, supplier_name")
    .is("tenant_id", null).gte("due_date", monthStart).lt("due_date", nextMonthStart).limit(2000);
  const pays = (pay || []) as any[];
  const psum = (arr: any[]) => arr.reduce((s, p) => s + num(p.amount), 0);
  const vencidas = pays.filter((p) => p.status === "pending" && p.due_date < today);
  ctx.financeiro = [
    `Mensalidades (faturas dos clientes) mês atual: ${pago(mesAtual).length} pagas = ${brl(sum(pago(mesAtual)))}; ${mesAtual.filter((i) => i.status === "overdue").length} vencidas = ${brl(sum(mesAtual.filter((i) => i.status === "overdue")))}; ${mesAtual.filter((i) => i.status === "pending").length} a vencer = ${brl(sum(mesAtual.filter((i) => i.status === "pending")))}.`,
    `Mês anterior: ${pago(mesAnt).length} pagas = ${brl(sum(pago(mesAnt)))} (${pct(sum(pago(mesAtual)), sum(pago(mesAnt)))} até agora).`,
    `Previsto pro próximo mês: ${prox.filter((i) => i.status === "pending").length} faturas = ${brl(sum(prox.filter((i) => i.status === "pending")))}.`,
    `Contas a pagar mês atual: pagas ${brl(psum(pays.filter((p) => p.status === "paid")))}, parciais ${brl(psum(pays.filter((p) => p.status === "partial")))}, em aberto ${brl(psum(pays.filter((p) => p.status === "pending")))}${vencidas.length ? ` (${vencidas.length} vencidas = ${brl(psum(vencidas))}: ${vencidas.slice(0, 4).map((p) => p.supplier_name).join(", ")})` : ""}.`,
  ].join("\n");

  // ── Carteira / churn / saúde ──
  const { data: projs } = await supabase.from("onboarding_projects")
    .select("id, status, product_name, churn_date, churn_reason, cancellation_signal_date, onboarding_companies!onboarding_projects_onboarding_company_id_fkey(name)")
    .limit(1000);
  const ps = (projs || []) as any[];
  const ativos = ps.filter((p) => p.status === "active");
  const churn30 = ps.filter((p) => p.churn_date && p.churn_date >= d30.slice(0, 10));
  const churn90 = ps.filter((p) => p.churn_date && p.churn_date >= d90.slice(0, 10));
  const sinal = ps.filter((p) => p.status === "cancellation_signaled");
  const motivos = new Map<string, number>();
  for (const p of churn90) { const m = p.churn_reason || "sem motivo"; motivos.set(m, (motivos.get(m) || 0) + 1); }
  ctx.clientesPerdidos = churn90.slice(0, 20).map((p) => ({ nome: p.onboarding_companies?.name || p.product_name, mes: String(p.churn_date).slice(0, 7), motivo: p.churn_reason || "sem motivo" }));
  const { data: hs } = await supabase.from("client_health_scores").select("project_id, total_score, risk_level").limit(500);
  const hsAtivos = ((hs || []) as any[]).filter((h) => ativos.some((p) => p.id === h.project_id));
  const risco = new Map<string, number>();
  for (const h of hsAtivos) risco.set(h.risk_level || "?", (risco.get(h.risk_level || "?") || 0) + 1);
  const { data: nps } = await supabase.from("onboarding_nps_responses").select("score").gte("created_at", d90).limit(500);
  const npsArr = ((nps || []) as any[]).map((n) => num(n.score));
  const npsMedia = npsArr.length ? (npsArr.reduce((a, b) => a + b, 0) / npsArr.length).toFixed(1) : "sem resposta";
  ctx.carteira = [
    `Clientes ativos: ${ativos.length} projetos. Sinal de cancelamento: ${sinal.length}.`,
    `Churn: ${churn30.length} nos últimos 30 dias, ${churn90.length} em 90 dias (${ativos.length + churn90.length > 0 ? Math.round((churn90.length / (ativos.length + churn90.length)) * 100) : 0}% da base). Motivos 90d: ${Array.from(motivos.entries()).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`).join(", ") || "nenhum"}.`,
    `Health score dos ativos: ${Array.from(risco.entries()).map(([r, n]) => `${r} ${n}`).join(", ") || "sem cálculo"}; média ${hsAtivos.length ? Math.round(hsAtivos.reduce((s, h) => s + num(h.total_score), 0) / hsAtivos.length) : "-"}.`,
    `NPS (90 dias): ${npsMedia} em ${npsArr.length} respostas.`,
  ].join("\n");

  // ── Meta Ads da UNV (crm_meta_ads_campaigns, tenant null) ──
  const { data: mc } = await supabase.from("crm_meta_ads_campaigns")
    .select("campaign_name, status, spend, leads, impressions, clicks, date_start, date_stop, result_indicator")
    .is("tenant_id", null).gte("date_start", d30.slice(0, 10)).limit(500);
  const cmap = new Map<string, { gasto: number; leads: number; cliques: number; status: string }>();
  for (const r of (mc || []) as any[]) {
    const cur = cmap.get(r.campaign_name) || { gasto: 0, leads: 0, cliques: 0, status: r.status };
    cur.gasto += num(r.spend); cur.leads += num(r.leads); cur.cliques += num(r.clicks); cur.status = r.status || cur.status;
    cmap.set(r.campaign_name, cur);
  }
  ctx.campanhas = Array.from(cmap.entries()).map(([nome, v]) => ({ nome, gasto: Math.round(v.gasto), leads: v.leads, cpl: v.leads ? Math.round(v.gasto / v.leads) : null }))
    .sort((a, b) => b.gasto - a.gasto).slice(0, 10);
  const gastoTotal = ctx.campanhas.reduce((s, c) => s + c.gasto, 0);
  const leadsTotal = ctx.campanhas.reduce((s, c) => s + c.leads, 0);
  ctx.trafego = ctx.campanhas.length
    ? `Meta Ads (30d): gasto ${brl(gastoTotal)}, ${leadsTotal} leads, CPL médio ${leadsTotal ? brl(gastoTotal / leadsTotal) : "-"}.\n` +
      ctx.campanhas.map((c) => `- ${c.nome}: gasto ${brl(c.gasto)}, ${c.leads} leads, CPL ${c.cpl != null ? brl(c.cpl) : "-"}`).join("\n")
    : "Meta Ads: sem campanha sincronizada nos últimos 30 dias.";

  // ── Catálogo ──
  const { data: cat } = await supabase.from("service_catalog").select("name, price, billing_type, description").eq("is_active", true).order("sort_order").limit(30);
  ctx.catalogo = ((cat || []) as any[]).map((s) => `- ${s.name}: ${brl(num(s.price))}${s.billing_type === "monthly" ? "/mês" : ""}${s.description ? ` — ${s.description}` : ""}`).join("\n");
}

async function buildContext(supabase: SupabaseClient, c: Company, agents: Agent[]): Promise<Ctx> {
  const max = agents.find((a) => a.agent_key === "orquestrador");
  const rafa = agents.find((a) => a.agent_key === "anuncios");
  const ctx: Ctx = {
    modo: max?.config?.dados === "nexus_unv" ? "nexus_unv" : "kpis",
    empresa: c.name, oferta: ofertaBlock(c, rafa?.config || {}),
    kpis: "", comercial: "", financeiro: "", carteira: "", trafego: "", catalogo: "",
    leadsParados: [], clientesPerdidos: [], leadsNovos: [], campanhas: [],
  };
  ctx.kpis = await kpiBlock(supabase, c.id);
  if (ctx.modo === "nexus_unv") await unvContext(supabase, ctx);
  return ctx;
}

function dadosBlock(ctx: Ctx, partes: ("kpis" | "comercial" | "financeiro" | "carteira" | "trafego" | "catalogo")[]): string {
  const out: string[] = [];
  for (const p of partes) {
    const v = ctx[p];
    if (!v) continue;
    const titulo = { kpis: "KPIs", comercial: "COMERCIAL (CRM)", financeiro: "FINANCEIRO", carteira: "CARTEIRA DE CLIENTES", trafego: "TRÁFEGO PAGO", catalogo: "CATÁLOGO DE SERVIÇOS" }[p];
    out.push(`${titulo}:\n${v}`);
  }
  return out.join("\n\n");
}

const REGRAS = `Regras: português do Brasil, direto, humano, sem emoji, sem markdown, sem frase corporativa ("solicito", "impacta diretamente", "alinhar"). Fale como um sócio que entende do negócio. Nunca invente número: use só o que está nos dados.`;

// ───────────────────────── especialistas ─────────────────────────

/** Bia — briefing da manhã com os dados reais. */
async function runBriefing(ctx: Ctx, agent: Agent, pendingApprovals: number): Promise<RunResult> {
  const dados = ctx.modo === "nexus_unv"
    ? dadosBlock(ctx, ["financeiro", "comercial", "carteira", "trafego"])
    : (ctx.kpis || "Nenhum KPI lançado.");
  const prompt = `Você é ${agent.name}, responsável pelo resumo diário no Time de IA da ${ctx.empresa}. Escreva o briefing da manhã pro dono.

DADOS DE HOJE:
${dados}
${pendingApprovals > 0 ? `\nFila do time: ${pendingApprovals} item(ns) esperando aprovação do dono.` : ""}

${REGRAS}
Formato: 8 a 12 linhas curtas, sem título nem cabeçalho. Comece pelo dinheiro (entrou x esperado, o que está vencido), depois comercial (leads, reuniões, fechamentos), depois carteira (churn, risco). Aponte os 2 pontos que mais merecem atenção e feche com 1 ação concreta pra HOJE, dizendo QUAL PESSOA DO TIME faz (financeiro, CS, pré-vendas, closer): você não liga, não cobra nem executa nada, só lê e orienta. Se um dado estiver vazio, diga que está vazio e o que falta lançar.`;
  const text = await askClaude(prompt, { maxTokens: 700, agent: "briefing" });
  return { status: "done", summary: text, output: { modo: ctx.modo } };
}

/** Rafa — 3 anúncios pra aprovação, apoiado no que já funciona. */
async function runAnuncios(ctx: Ctx, agent: Agent): Promise<RunResult> {
  const prompt = `Você é ${agent.name}, criador de anúncios do Time de IA. Crie 3 anúncios Meta Ads (Instagram/Facebook) diferentes entre si para a empresa abaixo.

${ctx.oferta}

${ctx.modo === "nexus_unv" ? dadosBlock(ctx, ["trafego", "comercial", "catalogo"]) : ctx.kpis}

Use os dados: se uma campanha ou origem já traz lead barato, faça pelo menos 1 anúncio no mesmo ângulo dela; se o CPL está alto, proponha um ângulo diferente e diga por quê no campo "racional". Não cite preço no texto do anúncio a menos que a oferta diga explicitamente que o preço é o gancho. NUNCA cite nome de cliente, lead ou pessoa no anúncio (prova social sem nome: "uma empresa de X", "um cliente do setor Y").
Cada anúncio com ângulo distinto (dor, prova/autoridade, oferta direta). Responda SOMENTE com JSON:
[{"angulo":"...","headline":"até 40 caracteres","texto":"texto principal de 3 a 5 linhas, sem emoji","cta":"ex: Saiba mais","publico":"descrição curta do público e interesses","racional":"1 frase: qual dado sustentou esse anúncio"}]`;
  const ads = parseJson<{ angulo: string; headline: string; texto: string; cta: string; publico: string; racional?: string }[]>(
    await askClaude(prompt, { maxTokens: 1600, agent: "anuncios" }),
  );
  const approvals = ads.slice(0, 3).map((ad) => ({ kind: "ad", title: ad.headline, payload: ad }));
  return { status: "done", summary: `Deixei ${approvals.length} anúncios prontos pra você aprovar, apoiados no tráfego dos últimos 30 dias.`, output: { ads }, approvals };
}

/** Nina — 3 posts (gancho, legenda, formato) a partir do que o comercial está vivendo. */
async function runConteudo(ctx: Ctx, agent: Agent): Promise<RunResult> {
  const prompt = `Você é ${agent.name}, responsável por conteúdo e social no Time de IA. Proponha 3 posts pro Instagram da empresa abaixo, pensados pra gerar conversa com cliente (não só curtida).

${ctx.oferta}

${ctx.modo === "nexus_unv" ? dadosBlock(ctx, ["comercial", "carteira", "trafego"]) : ctx.kpis}

Use os dados como matéria-prima, não como manchete: motivos de churn viram pauta de "como evitar"; fechamentos recentes viram prova (sem citar nome de cliente); origem que mais traz lead diz qual tema o público está respondendo. NUNCA exponha número interno da empresa no post (quantidade de clientes que saíram, reuniões canceladas, faturamento, churn) — isso é bastidor, não conteúdo. Não cite valores em reais no post.
Responda SOMENTE com JSON:
[{"formato":"reels|carrossel|estático","gancho":"primeira frase que segura a atenção","legenda":"legenda completa, sem emoji, com CTA no final","objetivo":"o que esse post deve gerar","racional":"1 frase: qual dado inspirou"}]`;
  const posts = parseJson<{ formato: string; gancho: string; legenda: string; objetivo: string; racional?: string }[]>(
    await askClaude(prompt, { maxTokens: 1600, agent: "conteudo" }),
  );
  const approvals = posts.slice(0, 3).map((p) => ({ kind: "post", title: p.gancho, payload: p }));
  return { status: "done", summary: `Separei ${approvals.length} posts pra semana a partir do que o comercial está vivendo.`, output: { posts }, approvals };
}

/** Theo — mensagens de reativação pra leads parados e clientes que saíram, com nome real. */
async function runReativacao(ctx: Ctx, agent: Agent): Promise<RunResult> {
  if (ctx.modo !== "nexus_unv" || (!ctx.leadsParados.length && !ctx.clientesPerdidos.length)) {
    const prompt = `Você é ${agent.name}, responsável por reativação no Time de IA. Escreva 3 mensagens de WhatsApp pra reativar contatos parados da empresa abaixo: uma pra cliente antigo que sumiu, uma pra lead que pediu orçamento e não fechou, uma pra quem comprou uma vez e não voltou.

${ctx.oferta}

${REGRAS} Tom de quem escreve do próprio celular, 3 a 4 linhas, termina com pergunta fácil de responder. Use {{nome}} no lugar do nome. Responda SOMENTE com JSON:
[{"alvo":"...","mensagem":"..."}]`;
    const msgs = parseJson<{ alvo: string; mensagem: string }[]>(await askClaude(prompt, { maxTokens: 900, agent: "reativacao" }));
    const approvals = msgs.slice(0, 3).map((m) => ({ kind: "message", title: `Reativação: ${m.alvo}`, payload: m }));
    return { status: "done", summary: `Montei ${approvals.length} mensagens de reativação (modelo, sem CRM ligado).`, output: { msgs }, approvals };
  }

  const leads = ctx.leadsParados.slice(0, 4);
  const perdidos = ctx.clientesPerdidos.filter((c) => c.motivo !== "Repassou a empresa").slice(0, 2);
  const prompt = `Você é ${agent.name}, responsável por reativação no Time de IA da ${ctx.empresa}. Escreva UMA mensagem de WhatsApp pra cada contato abaixo, como se o dono estivesse mandando do próprio celular.

${ctx.oferta}

LEADS PARADOS (sem contato há mais de 30 dias):
${leads.map((l, i) => `${i + 1}. ${l.name} — funil ${l.pipeline}, etapa "${l.stage}", ${l.dias} dias sem atividade${l.valor ? `, oportunidade ${brl(l.valor)}` : ""}${l.origem ? `, origem ${l.origem}` : ""}`).join("\n")}

CLIENTES QUE SAÍRAM (últimos 90 dias):
${perdidos.map((c, i) => `${leads.length + i + 1}. ${c.nome} — saiu em ${c.mes}, motivo registrado: ${c.motivo}`).join("\n") || "nenhum"}

${REGRAS} 3 a 4 linhas cada, use o primeiro nome da pessoa (se for razão social, use só o nome fantasia curto, sem LTDA), mencione o contexto real (etapa do funil ou motivo da saída) sem parecer que leu uma ficha, ofereça um motivo concreto pra conversa (uma novidade, um resultado recente, uma ideia pro negócio dela) e termine com UMA pergunta fácil de responder. Nada de "a porta está aberta" ou "se fizer sentido": quem reativa propõe, não espera. Pra quem saiu por insatisfação, reconheça em uma frase, sem se justificar. Responda SOMENTE com JSON, na mesma ordem:
[{"numero":1,"mensagem":"..."}]`;
  const msgs = parseJson<{ numero: number; mensagem: string }[]>(await askClaude(prompt, { maxTokens: 1400, agent: "reativacao" }));
  const alvos = [
    ...leads.map((l) => ({ tipo: "lead", id: l.id, nome: l.name, contexto: `${l.pipeline} · ${l.stage} · ${l.dias}d parado` })),
    ...perdidos.map((c) => ({ tipo: "cliente", id: null as string | null, nome: c.nome, contexto: `saiu em ${c.mes} · ${c.motivo}` })),
  ];
  const approvals = msgs.filter((m) => alvos[m.numero - 1]).map((m) => {
    const a = alvos[m.numero - 1];
    return { kind: "message", title: `${a.tipo === "lead" ? "Lead parado" : "Cliente que saiu"}: ${a.nome}`, payload: { alvo: a.nome, tipo: a.tipo, lead_id: a.id, contexto: a.contexto, mensagem: m.mensagem } };
  });
  return { status: "done", summary: `Montei ${approvals.length} mensagens com nome: ${leads.length} leads parados e ${perdidos.length} clientes que saíram.`, output: { alvos }, approvals };
}

/** Dudu — leitura do tráfego: o que traz lead barato, o que queima verba. */
async function runTrafego(ctx: Ctx, agent: Agent): Promise<RunResult> {
  if (ctx.modo !== "nexus_unv") return { status: "skipped", summary: "Sem conta Meta ligada a este time ainda." };
  if (!ctx.campanhas.length) return { status: "done", summary: "Nenhuma campanha da Meta sincronizada nos últimos 30 dias. Nada pra analisar." };
  const prompt = `Você é ${agent.name}, analista de tráfego do Time de IA da ${ctx.empresa}. Leia as campanhas e devolva o veredito.

${dadosBlock(ctx, ["trafego", "comercial"])}

${REGRAS} 5 a 8 linhas: qual campanha merece mais verba (e por quê), qual está queimando dinheiro (gasto sem lead ou CPL fora da curva), e 1 ajuste concreto pra fazer hoje (pausar, realocar, trocar criativo). Compare CPL entre campanhas. Se faltar dado de lead, diga que a campanha pode estar otimizada pra conversa e não pra formulário.`;
  const text = await askClaude(prompt, { maxTokens: 600, agent: "trafego" });
  return { status: "done", summary: text, output: { campanhas: ctx.campanhas } };
}

/** Júlia — leads das últimas 24h: quem está sem dono ou sem contato. */
async function runQualificacao(ctx: Ctx, agent: Agent): Promise<RunResult> {
  if (ctx.modo !== "nexus_unv") return { status: "skipped", summary: "Sem CRM ligado a este time ainda." };
  const novos = ctx.leadsNovos;
  if (!novos.length) return { status: "done", summary: "Nenhum lead novo nas últimas 24 horas." };
  const semDono = novos.filter((l) => l.semDono);
  const semContato = novos.filter((l) => l.semAtividade);
  const prompt = `Você é ${agent.name}, responsável por qualificação no Time de IA da ${ctx.empresa}. Chegaram ${novos.length} leads nas últimas 24h.

LEADS:
${novos.slice(0, 20).map((l) => `- ${l.name} — funil ${l.pipeline}${l.origem ? `, origem ${l.origem}` : ""}, há ${l.horas}h${l.semDono ? ", SEM DONO" : ""}${l.semAtividade ? ", SEM CONTATO" : ""}`).join("\n")}

${REGRAS} 4 a 7 linhas: quantos chegaram, quantos sem dono e sem contato, quais 3 devem ser ligados primeiro (nome + motivo curto: origem quente, funil de maior ticket, mais tempo esperando) e 1 recado pro time de pré-vendas.`;
  const text = await askClaude(prompt, { maxTokens: 500, agent: "qualificacao" });
  return { status: "done", summary: text, output: { total: novos.length, semDono: semDono.length, semContato: semContato.length, leads: novos.slice(0, 20) } };
}

async function runAgent(ctx: Ctx, agent: Agent, pendingApprovals: number): Promise<RunResult> {
  switch (agent.agent_key) {
    case "briefing": return runBriefing(ctx, agent, pendingApprovals);
    case "anuncios": return runAnuncios(ctx, agent);
    case "conteudo": return runConteudo(ctx, agent);
    case "reativacao": return runReativacao(ctx, agent);
    case "trafego": return runTrafego(ctx, agent);
    case "qualificacao": return runQualificacao(ctx, agent);
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

  let ctx: Ctx;
  try {
    ctx = await buildContext(supabase, c, agents);
  } catch (e) {
    await supabase.from("ai_team_runs").update({ status: "error", error: `contexto: ${(e as Error).message}`, finished_at: new Date().toISOString() }).eq("id", maxRun?.id);
    return { company: c.name, ran: [], error: `contexto: ${(e as Error).message}` };
  }

  const results: { agent: Agent; result: RunResult }[] = [];
  for (const agent of selected) {
    const { data: run } = await supabase.from("ai_team_runs")
      .insert({ company_id: c.id, agent_key: agent.agent_key, trigger: opts.trigger, status: "running" }).select("id").single();
    let result: RunResult;
    try {
      result = await runAgent(ctx, agent, pendingCount || 0);
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
  const relato = results.map((r) => `- ${r.agent.name} (${r.agent.role_title}): [${r.result.status}] ${r.result.summary.slice(0, 500)}`).join("\n");
  let maxText = "";
  try {
    maxText = await askClaude(`Você é ${max?.name || "Max"}, coordenador do Time de IA da ${c.name}. O time acabou de rodar. Escreva o recado pro dono: o que cada um entregou, o que está esperando a decisão dele e o que você, como coordenador, acha que ele deve olhar primeiro.

Rodada:
${relato}
${novasAprovacoes ? `\n${novasAprovacoes} item(ns) novos entraram na fila de aprovação.` : ""}

${REGRAS} 4 a 6 linhas, sem repetir o texto dos agentes na íntegra, sem saudação longa, sem assinatura. Se algo falhou, diga sem rodeio.`, { maxTokens: 450, agent: "orquestrador" });
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
    output: { ran: results.map((r) => ({ agent: r.agent.agent_key, status: r.result.status })), novasAprovacoes, whatsapp, modo: ctx.modo },
  }).eq("id", maxRun?.id);
  if (max) await supabase.from("ai_team_agents").update({ last_run_at: new Date().toISOString() }).eq("id", max.id);

  return { company: c.name, modo: ctx.modo, ran: results.map((r) => ({ agent: r.agent.agent_key, status: r.result.status })), novasAprovacoes, whatsapp };
}

// ───────────────────────── handler ─────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const role = jwtRole(token);

    let companyIds: string[] = [];
    let trigger: "manual" | "cron" = "manual";

    if (body.scheduled === true) {
      // cron do projeto chama com a anon key (padrão dos outros crons); service role também vale.
      // O gateway já validou a assinatura do JWT (verify_jwt), então basta olhar o papel.
      // Modo agendado é idempotente (1 rodada por agente/dia), então não há o que abusar.
      if (!["anon", "service_role"].includes(role)) return json({ error: "cron exige chave do projeto" }, 401);
      trigger = "cron";
      const { data } = await supabase.from("ai_team_agents").select("company_id")
        .eq("agent_key", "orquestrador").eq("is_active", true);
      companyIds = Array.from(new Set(((data || []) as any[]).map((r) => r.company_id)));
    } else {
      if (!body.companyId) return json({ error: "companyId obrigatório" }, 400);
      if (role !== "service_role") {
        // quem chama precisa ter acesso à empresa (cliente ou staff) — checado com o JWT do próprio usuário
        // (apikey = service role só pra passar no gateway; o Authorization do usuário é o que manda no RLS)
        const asUser = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await asUser.auth.getUser(token);
        if (!user) return json({ error: "não autenticado" }, 401);
        // mesma regra da RLS: cliente da empresa, staff alocado, ou master/admin
        const { data: ok } = await asUser.rpc("ai_team_has_access", { p_company_id: body.companyId });
        if (!ok) return json({ error: "sem acesso à empresa" }, 403);
      }
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
