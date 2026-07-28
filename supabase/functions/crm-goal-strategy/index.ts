// Estratégia pra Bater a Meta — 3 níveis (gestão / closer / SDR), com dados
// REAIS do CRM: metas e vendas do mês, leads abertos (valor, etapa, fit,
// transcrições), contratos no cartão renegociáveis pra PIX mensal e a base do
// SDR (sem desfecho, no-shows, ritmo necessário). A IA monta o plano realista;
// cache 1x/dia por nível+pessoa (botão Atualizar força).
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = "claude-sonnet-4-6";
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const trunc = (s: unknown, n: number) => String(s || "").replace(/\s+/g, " ").slice(0, n);

function businessDaysLeft(now: Date): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let n = 0;
  for (let d = now.getDate(); d <= last.getDate(); d++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return j({ error: "não autenticado" }, 401);

    const { data: staff } = await supabase
      .from("onboarding_staff").select("id, name, role")
      .eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!staff) return j({ error: "colaborador não encontrado" }, 403);

    const role = String(staff.role || "").toLowerCase();
    const level = ["master", "admin", "head_comercial"].includes(role) ? "gestao"
      : role === "closer" ? "closer" : "sdr";

    let body: any = {};
    try { body = await req.json(); } catch { /* ok */ }
    const force = !!body.force;

    const now = new Date(Date.now() - 3 * 3600000); // BRT
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const monthYear = `${y}-${String(m).padStart(2, "0")}`;
    const monthStart = `${monthYear}-01`;
    const daysLeft = businessDaysLeft(now);
    const staffKey = level === "gestao" ? null : staff.id;

    // cache do dia
    if (!force) {
      let cq = supabase
        .from("crm_goal_strategies").select("strategy, generated_at")
        .eq("level", level).eq("month_year", monthYear);
      cq = staffKey === null ? cq.is("staff_id", null) : cq.eq("staff_id", staffKey);
      const { data: cached } = await cq.order("generated_at", { ascending: false }).limit(1).maybeSingle();
      if (cached && String(cached.generated_at).slice(0, 10) === now.toISOString().slice(0, 10)) {
        return j({ ok: true, level, cached: true, generated_at: cached.generated_at, strategy: cached.strategy });
      }
    }

    // ── metas ──
    const { data: types } = await supabase.from("crm_goal_types").select("id, name, category, has_ote").eq("is_active", true);
    const closerType = (types || []).find(t => t.category === "closer" && t.has_ote) || (types || []).find(t => t.name === "Vendas");
    const sdrType = (types || []).find(t => t.category === "sdr" && /agendam|reuni/i.test(t.name));
    const typeIds = [closerType?.id, sdrType?.id].filter(Boolean) as string[];
    const { data: goalRows } = await supabase
      .from("crm_goal_values")
      .select("staff_id, goal_type_id, meta_value, staff:onboarding_staff(id, name, role)")
      .in("goal_type_id", typeIds).eq("month", m).eq("year", y);

    const closerGoals = (goalRows || []).filter((g: any) => g.goal_type_id === closerType?.id && Number(g.meta_value) > 0);
    const sdrGoals = (goalRows || []).filter((g: any) => g.goal_type_id === sdrType?.id && Number(g.meta_value) > 0);

    // ── vendas do mês (só funis que contam pra meta) ──
    const { data: pipes } = await supabase.from("crm_pipelines").select("id, name, counts_for_goals");
    const excluded = new Set((pipes || []).filter((p: any) => p.counts_for_goals === false).map((p: any) => p.id));
    const { data: salesRaw } = await supabase
      .from("crm_sales")
      .select("billing_value, closer_staff_id, sale_date, pipeline_id, lead:crm_leads(name, pipeline_id)")
      .gte("sale_date", monthStart);
    const sales = (salesRaw || []).filter((s: any) => {
      const pid = s.pipeline_id || s.lead?.pipeline_id;
      return !pid || !excluded.has(pid);
    });
    const salesByCloser = new Map<string, { total: number; count: number }>();
    sales.forEach((s: any) => {
      if (!s.closer_staff_id) return;
      const e = salesByCloser.get(s.closer_staff_id) || { total: 0, count: 0 };
      e.total += Number(s.billing_value) || 0; e.count++;
      salesByCloser.set(s.closer_staff_id, e);
    });
    const totalSold = sales.reduce((s: number, x: any) => s + (Number(x.billing_value) || 0), 0);
    const totalMeta = closerGoals.reduce((s: number, g: any) => s + Number(g.meta_value), 0);

    // ── leads abertos com valor (pipeline aberto) ──
    let leadsQ = supabase
      .from("crm_leads")
      .select("id, name, company, opportunity_value, fit_score, notes, owner_staff_id, updated_at, stage:crm_stages(name, is_final), owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name)")
      .gt("opportunity_value", 0)
      .order("opportunity_value", { ascending: false })
      .limit(80);
    if (level === "closer") leadsQ = leadsQ.eq("owner_staff_id", staff.id);
    const { data: leadsRaw } = await leadsQ;
    const openLeads = (leadsRaw || []).filter((l: any) => !l.stage?.is_final).slice(0, 40);

    // transcrições dos top leads (inteligência das calls)
    const topIds = openLeads.slice(0, 12).map((l: any) => l.id);
    const { data: trans } = topIds.length
      ? await supabase.from("crm_transcriptions")
          .select("lead_id, summary, recorded_at")
          .in("lead_id", topIds).not("summary", "is", null)
          .order("recorded_at", { ascending: false })
      : { data: [] as any[] };
    const transByLead = new Map<string, string>();
    (trans || []).forEach((t: any) => { if (!transByLead.has(t.lead_id)) transByLead.set(t.lead_id, trunc(t.summary, 350)); });

    // ── renegociação: pagamentos no cartão parcelado (migrar pra PIX mensal) ──
    const d90 = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: cardPays } = await supabase
      .from("crm_lead_payments")
      .select("amount_cents, installments, status, provider, created_at, lead:crm_leads(name, company, owner_staff_id)")
      .gt("installments", 1).gte("created_at", d90).in("status", ["pending", "paid"]);

    // ── base do SDR ──
    const sdrIds = sdrGoals.map((g: any) => g.staff_id);
    const { data: monthEvents } = await supabase
      .from("crm_meeting_events")
      .select("lead_id, event_type, event_date, credited_staff_id, lead:crm_leads!crm_meeting_events_lead_id_fkey(id, name, sdr_staff_id, scheduled_by_staff_id)")
      .gte("event_date", `${monthStart}T00:00:00Z`);
    const attributed = (monthEvents || []).map((e: any) => ({
      ...e, attr: e.lead?.sdr_staff_id || e.lead?.scheduled_by_staff_id || e.credited_staff_id || null,
    }));
    const uniq = (evs: any[]) => {
      const seen = new Set<string>(); return evs.filter(e => {
        const k = `${e.lead_id}|${e.event_type}|${String(e.event_date).slice(0, 16)}`;
        if (seen.has(k)) return false; seen.add(k); return true;
      });
    };
    const realizedBySdr = new Map<string, number>();
    uniq(attributed.filter(e => e.event_type === "realized")).forEach(e => {
      if (e.attr) realizedBySdr.set(e.attr, (realizedBySdr.get(e.attr) || 0) + 1);
    });
    // sem desfecho + no-shows (matéria-prima de reagendamento)
    const byLeadTypes = new Map<string, { name: string; types: Set<string>; last: string }>();
    attributed.forEach((e: any) => {
      const r = byLeadTypes.get(e.lead_id) || { name: e.lead?.name || "?", types: new Set(), last: "" };
      r.types.add(e.event_type); if (String(e.event_date) > r.last) r.last = String(e.event_date).slice(0, 10);
      byLeadTypes.set(e.lead_id, r);
    });
    const semDesfecho: string[] = []; const noShows: string[] = [];
    byLeadTypes.forEach(r => {
      if (r.types.has("scheduled") && !r.types.has("realized") && !r.types.has("no_show") && !r.types.has("out_of_icp")) semDesfecho.push(`${r.name} (agendada ${r.last})`);
      else if (r.types.has("no_show") && !r.types.has("realized")) noShows.push(`${r.name} (no-show ${r.last})`);
    });

    // ── monta o contexto pro modelo ──
    const closersBlock = closerGoals.map((g: any) => {
      const s = salesByCloser.get(g.staff_id) || { total: 0, count: 0 };
      return `- ${g.staff?.name} (${g.staff?.role}): meta ${brl(Number(g.meta_value))} | vendido ${brl(s.total)} (${s.count} vendas) | falta ${brl(Math.max(0, Number(g.meta_value) - s.total))}`;
    }).join("\n");
    const sdrBlock = sdrGoals.map((g: any) => {
      const r = realizedBySdr.get(g.staff_id) || 0;
      return `- ${g.staff?.name}: meta ${g.meta_value} reuniões realizadas | feitas ${r} | faltam ${Math.max(0, Number(g.meta_value) - r)}`;
    }).join("\n");
    const leadsBlock = openLeads.map((l: any) => {
      const t = transByLead.get(l.id);
      return `- ${l.name}${l.company ? ` (${l.company})` : ""} | ${brl(Number(l.opportunity_value))} | etapa: ${l.stage?.name || "?"} | dono: ${l.owner?.name || "?"} | fit: ${l.fit_score ?? "—"} | últ. att: ${String(l.updated_at).slice(0, 10)}${l.notes ? ` | notas: ${trunc(l.notes, 120)}` : ""}${t ? `\n  call: ${t}` : ""}`;
    }).join("\n");
    const renegBlock = (cardPays || []).map((p: any) =>
      `- ${p.lead?.name}${p.lead?.company ? ` (${p.lead.company})` : ""}: ${brl((p.amount_cents || 0) / 100)} no cartão ${p.installments}x (${p.status}) — candidato a renegociar pra PIX mensal recorrente`
    ).join("\n");

    const focoNivel = level === "gestao"
      ? "NÍVEL GESTÃO: além do plano geral, monte um plano individual pra CADA closer e CADA SDR (campo por_pessoa)."
      : level === "closer"
        ? `NÍVEL CLOSER (${staff.name}): estratégias APENAS sobre os leads deste closer. Sem plano de outras pessoas (por_pessoa = []).`
        : `NÍVEL SDR (${staff.name}): foco em gerar as reuniões que faltam — reagendar no-shows, resgatar sem-desfecho, cadência na base. (por_pessoa = []).`;

    const prompt = `Você é o diretor comercial da UNV. Hoje é ${now.toISOString().slice(0, 10)}, restam ${daysLeft} dias úteis no mês.
Monte a ESTRATÉGIA PRA BATER A META usando SOMENTE os dados abaixo (reais, do CRM). Seja realista: se a meta não fecha 100%, diga o máximo alcançável e como.

${focoNivel}

== METAS E VENDAS DO MÊS (empresa) ==
Meta total: ${brl(totalMeta)} | Vendido: ${brl(totalSold)} | Falta: ${brl(Math.max(0, totalMeta - totalSold))}
Closers:
${closersBlock || "(sem metas de closer cadastradas)"}
SDRs (meta em reuniões realizadas):
${sdrBlock || "(sem metas de SDR cadastradas)"}

== LEADS ABERTOS COM VALOR (pipeline vivo, maiores primeiro) ==
${leadsBlock || "(nenhum lead aberto com valor)"}

== CONTRATOS NO CARTÃO PARCELADO (últimos 90d — renegociáveis pra PIX mensal, gera MRR e pode antecipar caixa) ==
${renegBlock || "(nenhum)"}

== BASE DO SDR (reagendável) ==
Agendadas SEM DESFECHO (${semDesfecho.length}): ${semDesfecho.slice(0, 15).join("; ") || "—"}
No-shows do mês (${noShows.length}): ${noShows.slice(0, 12).join("; ") || "—"}

Responda APENAS um JSON válido, sem markdown, neste formato:
{"resumo": "diagnóstico direto em 2-3 frases",
 "gap": {"meta": number, "realizado": number, "falta": number, "dias_uteis": ${daysLeft}, "cenario_realista": "o que dá pra alcançar de verdade e por quê"},
 "estrategias": [{"titulo": "...", "como_executar": "passo a passo curto e concreto, citando leads/valores REAIS dos dados", "embasamento": "qual dado sustenta (lead X, call Y, contrato Z)", "impacto_estimado": "R$ ou nº reuniões", "prioridade": 1}],
 "por_pessoa": [{"nome": "...", "papel": "closer|sdr", "meta": "...", "realizado": "...", "plano": ["ação 1", "ação 2"]}]}
Regras: máx 6 estratégias, ordenadas por prioridade (1 = maior impacto/menor esforço). Cite nomes e valores reais. Nada genérico tipo "faça follow-up" sem dizer em quem. Tom direto, sem enrolação.`;

    if (!ANTHROPIC_KEY) return j({ error: "ANTHROPIC_API_KEY não configurada" }, 500);
    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3500, messages: [{ role: "user", content: prompt }] }),
    });
    const aiData = await aiResp.json();
    if (!aiResp.ok) return j({ error: aiData?.error?.message || "IA falhou" }, 500);
    let text = (aiData.content || []).map((c: any) => c.text || "").join("");
    text = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    let strategy: any;
    try { strategy = JSON.parse(text); } catch {
      const a = text.indexOf("{"), b = text.lastIndexOf("}");
      strategy = JSON.parse(text.slice(a, b + 1));
    }

    // persiste (upsert manual por nível+pessoa+mês)
    await supabase.from("crm_goal_strategies").delete()
      .eq("level", level).eq("month_year", monthYear)
      [staffKey === null ? "is" : "eq"]("staff_id", staffKey as any);
    await supabase.from("crm_goal_strategies").insert({ level, staff_id: staffKey, month_year: monthYear, strategy });

    return j({ ok: true, level, cached: false, generated_at: new Date().toISOString(), strategy });
  } catch (e) {
    return j({ error: String((e as Error).message || e) }, 500);
  }
});
