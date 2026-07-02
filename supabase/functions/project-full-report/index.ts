// Relatório completo do projeto: junta reuniões, ações, KPIs/resultados e as conversas
// dos grupos de WhatsApp (gestão + vendedores, via projeto do Marcelo), resume com IA
// e devolve tudo estruturado + gráficos (PNG do QuickChart) pro front montar o PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MARCELO_URL = Deno.env.get("MARCELO_SUPABASE_URL");
const MARCELO_KEY = Deno.env.get("MARCELO_SERVICE_KEY");
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");

const NAVY = "#0D2B5E", RED = "#CC1B1B", GREEN = "#1E7A33";
const brMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m - 1] + "/" + y.slice(2);
};
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b(ltda|me|mei|eireli|epp|sa|s\/a)\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

async function chartPng(chart: unknown): Promise<string | null> {
  try {
    const r = await fetch("https://quickchart.io/chart", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: 760, height: 340, backgroundColor: "white", format: "png", chart }),
    });
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return "data:image/png;base64," + btoa(bin);
  } catch { return null; }
}

async function aiNarrative(ctx: string): Promise<any> {
  if (!ANTHROPIC) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: `Você é o diretor comercial da UNV (Universidade Nacional de Vendas) escrevendo, para o CLIENTE, um relatório PREMIUM e detalhado do trabalho feito na empresa dele. Tom: profissional, humano, direto, orientado a resultado, sem enrolação e sem inventar dados — use só o que está no contexto. Escreva em português do Brasil.

Com base no CONTEXTO abaixo, retorne SOMENTE um JSON válido (sem markdown, sem cercas), no formato:
{
 "resumo_executivo": "2 a 3 parágrafos abrindo o relatório: a parceria, o que foi construído e o resultado em uma leitura de alto nível",
 "o_que_fizemos": ["frase 1 do que a UNV executou", "frase 2", "..."],  // 6 a 10 itens concretos e específicos, baseados nas reuniões e ações
 "reunioes": [{"data": "YYYY-MM-DD", "titulo": "título curto", "resumo": "1 a 2 frases: o que foi tratado/decidido nessa reunião"}],  // UMA entrada por reunião do contexto (máx 15, as mais relevantes), na ordem cronológica
 "acoes": [{"titulo": "título EXATO da ação como está no contexto", "resumo": "1 a 2 frases: o que foi feito, o diagnóstico/motivo e a melhoria gerada"}],  // UMA entrada para CADA ação que tiver DETALHE no contexto (use o campo DETALHE + o que souber das reuniões). Ações sem material, OMITA — não invente. Máx 60.
 "resultado": "2 parágrafos sobre os resultados gerados, citando os números que existem (faturamento, evolução, ações). Se os números forem escassos, seja honesto e foque no que foi estruturado.",
 "analise_grupos": "1 a 2 parágrafos sobre o acompanhamento pelos grupos de WhatsApp (gestão e vendedores): ritmo, temas, engajamento e como a consultoria conduziu o time — sem citar mensagens específicas nem nomes de pacientes",
 "destaques": ["destaque 1", "destaque 2", "destaque 3", "destaque 4"],  // 3 a 4 pontos fortes/conquistas
 "proximos_passos": ["passo 1", "passo 2", "passo 3"]  // 3 a 5 recomendações concretas de continuidade
}

CONTEXTO:
${ctx}`,
        }],
      }),
    });
    const d = await r.json();
    let txt = d?.content?.[0]?.text || "";
    txt = txt.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    return JSON.parse(txt.slice(a, b + 1));
  } catch (e) { console.error("aiNarrative", e); return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { project_id, since, until } = await req.json();
    if (!project_id) return json({ error: "project_id obrigatório" }, 400);
    const sb = createClient(SUPABASE_URL, SERVICE);

    // ---- projeto + empresa ----
    const { data: proj, error: pe } = await sb.from("onboarding_projects")
      .select("id, product_name, status, created_at, contract_start_date, contract_end_date, contract_value, current_nps, consultant_id, cs_id, onboarding_company_id, onboarding_company:onboarding_companies(id, name, segment)")
      .eq("id", project_id).single();
    if (pe || !proj) return json({ error: "projeto não encontrado" }, 404);
    const company: any = proj.onboarding_company || {};
    const companyId = proj.onboarding_company_id;

    // consultor / CS
    const staffIds = [proj.consultant_id, proj.cs_id].filter(Boolean);
    let consultant = "", cs = "";
    if (staffIds.length) {
      const { data: staff } = await sb.from("onboarding_staff").select("id, name").in("id", staffIds);
      consultant = staff?.find((s: any) => s.id === proj.consultant_id)?.name || "";
      cs = staff?.find((s: any) => s.id === proj.cs_id)?.name || "";
    }

    const gte = (q: any, col: string) => since ? q.gte(col, since) : q;
    const lte = (q: any, col: string) => until ? q.lte(col, until) : q;

    // ---- reuniões ----
    let mQ = sb.from("onboarding_meeting_notes")
      .select("meeting_title, meeting_date, subject, notes, transcript, is_no_show, is_internal")
      .eq("project_id", project_id).order("meeting_date", { ascending: true });
    mQ = lte(gte(mQ, "meeting_date"), "meeting_date");
    const { data: mRows } = await mQ;
    const meetings = (mRows || []).filter((m: any) => !m.is_no_show && !m.is_internal);

    // ---- ações (tarefas concluídas) ----
    let tQ = sb.from("onboarding_tasks").select("title, status, created_at, completed_at, tags, description, observations").eq("project_id", project_id);
    const { data: tRows } = await tQ;
    // filtro de período em código: a data efetiva é completed_at, com fallback em created_at
    const inPeriod = (t: any) => {
      const dt = (t.completed_at || t.created_at || "").slice(0, 10);
      return (!since || dt >= since) && (!until || dt <= until);
    };
    const done = (tRows || []).filter((t: any) => (t.status === "completed" || t.completed_at) && inPeriod(t));
    const openCount = (tRows || []).filter((t: any) => t.status !== "completed" && !t.completed_at).length;
    const dateOf = (t: any) => (t.completed_at || t.created_at || "").slice(0, 7);
    const actionsByMonth: Record<string, number> = {};
    done.forEach((t: any) => { const m = dateOf(t); if (m) actionsByMonth[m] = (actionsByMonth[m] || 0) + 1; });

    // ---- KPIs / resultados ----
    const { data: kpis } = await sb.from("company_kpis").select("id, name, kpi_type, is_main_goal, target_value").eq("company_id", companyId);
    const fatKpi = (kpis || []).find((k: any) => (k.is_main_goal && k.kpi_type === "monetary")) ||
      (kpis || []).find((k: any) => /fatur|receit|venda/i.test(k.name) && k.kpi_type === "monetary");
    const salesKpi = (kpis || []).find((k: any) => /venda/i.test(k.name) && k.kpi_type !== "monetary");
    let eQ = sb.from("kpi_entries").select("kpi_id, entry_date, value").eq("company_id", companyId);
    eQ = lte(gte(eQ, "entry_date"), "entry_date");
    const { data: eRows } = await eQ;
    const fatMensal: Record<string, number> = {};
    let fatTotal = 0, vendasTotal = 0;
    (eRows || []).forEach((e: any) => {
      const m = (e.entry_date || "").slice(0, 7); const v = Number(e.value) || 0;
      if (fatKpi && e.kpi_id === fatKpi.id) { fatMensal[m] = (fatMensal[m] || 0) + v; fatTotal += v; }
      if (salesKpi && e.kpi_id === salesKpi.id) vendasTotal += v;
    });
    const fatSerie = Object.keys(fatMensal).sort().map((m) => ({ mes: m, valor: fatMensal[m] }));

    // ---- WhatsApp (grupos via Marcelo, cross-conta) ----
    let groups: any = { gestao: null, vendedores: null };
    let groupSamples = "";
    if (MARCELO_URL && MARCELO_KEY) {
      try {
        const mc = createClient(MARCELO_URL, MARCELO_KEY);
        const { data: grps } = await mc.from("marcelo_groups").select("group_jid, group_name, group_type, company_id, company_name");
        const nName = norm(company.name || "");
        const mine = (grps || []).filter((g: any) =>
          (companyId && g.company_id === companyId) ||
          (nName && g.company_name && (norm(g.company_name).includes(nName) || nName.includes(norm(g.company_name)))));
        for (const g of mine) {
          const isVend = /vend/i.test(g.group_type || "") || /vend/i.test(g.group_name || "");
          const key = isVend ? "vendedores" : "gestao";
          let cQ = mc.from("marcelo_group_messages").select("sender_name, message_text, msg_timestamp", { count: "exact" }).eq("group_jid", g.group_jid);
          cQ = cQ.not("message_text", "is", null).neq("message_text", "").order("msg_timestamp", { ascending: false }).limit(40);
          const { data: msgs, count } = await cQ;
          groups[key] = { nome: g.group_name, total: count || (msgs?.length || 0) };
          const sample = (msgs || []).slice(0, 30).reverse()
            .map((x: any) => `${(x.sender_name || "?")}: ${(x.message_text || "").slice(0, 140)}`).join("\n");
          groupSamples += `\n[GRUPO ${key.toUpperCase()} — ${g.group_name}] (${count || 0} mensagens no total)\nAmostra recente:\n${sample}\n`;
        }
      } catch (e) { console.error("marcelo", e); }
    }

    // ---- contexto p/ IA ----
    const ctx = [
      `EMPRESA: ${company.name || "-"} | Segmento: ${company.segment || "-"} | Serviço UNV: ${proj.product_name || "-"}`,
      `Consultor: ${consultant || "-"} | CS: ${cs || "-"} | Início: ${proj.contract_start_date || proj.created_at?.slice(0, 10) || "-"} | NPS: ${proj.current_nps ?? "-"}`,
      `\nREUNIÕES (${meetings.length}):`,
      ...meetings.map((m: any) => `- ${(m.meeting_date || "").slice(0, 10)} | ${m.meeting_title || m.subject || "Reunião"} | ${(m.notes || m.transcript || "").replace(/\s+/g, " ").slice(0, 700)}`),
      `\nAÇÕES CONCLUÍDAS (${done.length}; ${openCount} em aberto):`,
      ...done.slice(0, 120).map((t: any) => {
        const det = [t.description, t.observations].filter(Boolean).join(" | ").replace(/\s+/g, " ").slice(0, 380);
        return `- ${(t.completed_at || t.created_at || "").slice(0, 10)} | ${t.title}${det ? ` || DETALHE: ${det}` : ""}`;
      }),
      `\nRESULTADOS (KPI):`,
      `Faturamento total no período: R$ ${fatTotal.toLocaleString("pt-BR")} | Vendas: ${vendasTotal}`,
      `Faturamento mês a mês: ${fatSerie.map((s) => `${brMonth(s.mes)}=R$${Math.round(s.valor).toLocaleString("pt-BR")}`).join(", ") || "sem lançamentos"}`,
      `\nCONVERSAS DOS GRUPOS DE WHATSAPP:${groupSamples || " (sem grupos vinculados)"}`,
    ].join("\n");

    const narrative = await aiNarrative(ctx) || {
      resumo_executivo: `Relatório do trabalho realizado pela UNV na ${company.name}.`,
      o_que_fizemos: done.slice(0, 8).map((t: any) => t.title),
      reunioes: [], acoes: [],
      resultado: `Faturamento no período: R$ ${fatTotal.toLocaleString("pt-BR")}.`,
      analise_grupos: "", destaques: [], proximos_passos: [],
    };

    // ---- gráficos (QuickChart) ----
    const charts: any = {};
    if (fatSerie.length) {
      charts.faturamento = await chartPng({
        type: "bar",
        data: { labels: fatSerie.map((s) => brMonth(s.mes)), datasets: [{ label: "Faturamento (R$)", data: fatSerie.map((s) => Math.round(s.valor)), backgroundColor: NAVY }] },
        options: { plugins: { legend: { display: false }, title: { display: true, text: "Evolução do Faturamento", color: NAVY, font: { size: 16 } } }, scales: { y: { beginAtZero: true, ticks: { callback: "function(v){return 'R$ '+v.toLocaleString('pt-BR')}" } } } },
      });
    }
    const amKeys = Object.keys(actionsByMonth).sort();
    if (amKeys.length) {
      charts.acoes = await chartPng({
        type: "bar",
        data: { labels: amKeys.map(brMonth), datasets: [{ label: "Ações concluídas", data: amKeys.map((m) => actionsByMonth[m]), backgroundColor: GREEN }] },
        options: { plugins: { legend: { display: false }, title: { display: true, text: "Ações Realizadas por Mês", color: NAVY, font: { size: 16 } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
      });
    }

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      period: { since: since || null, until: until || null },
      company: { name: company.name, segment: company.segment },
      project: { product: proj.product_name, status: proj.status, start: proj.contract_start_date || proj.created_at?.slice(0, 10), nps: proj.current_nps, consultant, cs, contractValue: proj.contract_value },
      meetings: meetings.map((m: any) => ({ date: (m.meeting_date || "").slice(0, 10), title: m.meeting_title || m.subject || "Reunião", hasNotes: !!(m.notes || m.transcript) })),
      meetingsCount: meetings.length,
      actions: { total: done.length, open: openCount, byMonth: actionsByMonth, list: done.map((t: any) => ({ date: (t.completed_at || t.created_at || "").slice(0, 10), title: t.title })) },
      kpis: { faturamentoMensal: fatSerie, faturamentoTotal: fatTotal, vendasTotal },
      groups,
      narrative,
      charts,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
