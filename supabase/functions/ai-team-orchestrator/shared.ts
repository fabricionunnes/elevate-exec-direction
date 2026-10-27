// Time de IA — código comum do orquestrador (Max) e do chat com o Max:
// tipos, horário de Brasília, chamada ao Claude, medidor de tokens, WhatsApp e,
// principalmente, buildContext(): o "contexto" com os dados reais que todo agente lê.
// A pasta ai-team-chat tem um symlink pra este arquivo (o deploy sobe os dois).
import { SupabaseClient } from "@supabase/supabase-js";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const MODEL = Deno.env.get("AI_TEAM_MODEL") || "claude-haiku-4-5";
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type AgentKey = "orquestrador" | "atendimento" | "briefing" | "anuncios" | "conteudo" | "reativacao" | "trafego" | "qualificacao";
export type Agent = { id: string; agent_key: AgentKey; name: string; role_title: string; is_active: boolean; schedule: { hour?: string; days?: number[] } | null; config: Record<string, any>; last_run_at?: string | null };
export type Company = { id: string; name: string; segment: string | null; phone: string | null };

// ── horário de Brasília ──
export function brNow(): Date { return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })); }
export function brToday(): string {
  const d = brNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function brNowSlot(): string {
  const d = brNow();
  let h = d.getHours();
  const min = d.getMinutes();
  let m = 0;
  if (min >= 15 && min < 45) m = 30;
  else if (min >= 45) { m = 0; h = (h + 1) % 24; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export function daysAgo(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const brl = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
export const num = (v: any) => Number(v || 0);
export const pct = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "sem base");
export const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Papel (claim "role") de um JWT já validado pelo gateway; "" se não der pra ler. */
export function jwtRole(token: string): string {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return String(JSON.parse(atob(payload))?.role || "");
  } catch { return ""; }
}

/** medidor de tokens (fire-and-forget), mesmo padrão das outras funções */
export function logUsoIA(fn: string, model: string, usage: any, meta?: Record<string, unknown>) {
  try {
    fetch(`${SUPABASE_URL}/rest/v1/ai_usage_log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
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

/** Chamada simples (sem ferramentas): devolve só o texto. */
export async function askClaude(prompt: string, opts: { maxTokens?: number; temperature?: number; agent: string; fn?: string }): Promise<string> {
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
  logUsoIA(opts.fn || "ai-team-orchestrator", MODEL, data?.usage, { agent: opts.agent });
  return (data?.content?.[0]?.text || "").trim();
}

/** Extrai o primeiro JSON (objeto ou array) de uma resposta da IA. */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = Math.min(...["{", "["].map((c) => { const i = cleaned.indexOf(c); return i < 0 ? Infinity : i; }));
  if (!Number.isFinite(start)) throw new Error("IA não devolveu JSON");
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

/** Envia texto pela instância padrão (mesma lógica do resumo-diario-gestao). */
export async function sendWhatsApp(supabase: SupabaseClient, number: string, text: string): Promise<boolean> {
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

export type StaleLead = { id: string; name: string; pipeline: string; stage: string; dias: number; valor: number; origem: string | null };
export type Ctx = {
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

export function ofertaBlock(c: Company, cfg: Record<string, any>): string {
  const lines = [`Empresa: ${c.name}`];
  if (c.segment) lines.push(`Segmento: ${c.segment}`);
  if (cfg.oferta) lines.push(`Oferta principal: ${cfg.oferta}`);
  if (cfg.publico) lines.push(`Público-alvo: ${cfg.publico}`);
  if (cfg.tom) lines.push(`Tom de voz da marca: ${cfg.tom}`);
  return lines.join("\n");
}

/** Bloco de KPIs lançados (company_kpis/kpi_entries) — vale pra qualquer empresa. */
export async function kpiBlock(supabase: SupabaseClient, companyId: string): Promise<string> {
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
export async function unvContext(supabase: SupabaseClient, ctx: Ctx): Promise<void> {
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
  const meetings = ((acts || []) as any[]);
  const m7 = meetings.filter((a) => a.scheduled_at >= d7);
  const cnt = (arr: any[], st: string) => arr.filter((a) => a.status === st).length;

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

export async function buildContext(supabase: SupabaseClient, c: Company, agents: Agent[]): Promise<Ctx> {
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

export function dadosBlock(ctx: Ctx, partes: ("kpis" | "comercial" | "financeiro" | "carteira" | "trafego" | "catalogo")[]): string {
  const out: string[] = [];
  for (const p of partes) {
    const v = ctx[p];
    if (!v) continue;
    const titulo = { kpis: "KPIs", comercial: "COMERCIAL (CRM)", financeiro: "FINANCEIRO", carteira: "CARTEIRA DE CLIENTES", trafego: "TRÁFEGO PAGO", catalogo: "CATÁLOGO DE SERVIÇOS" }[p];
    out.push(`${titulo}:\n${v}`);
  }
  return out.join("\n\n");
}

export const REGRAS = `Regras: português do Brasil, direto, humano, sem emoji, sem markdown, sem frase corporativa ("solicito", "impacta diretamente", "alinhar"). Fale como um sócio que entende do negócio. Nunca invente número: use só o que está nos dados.`;
