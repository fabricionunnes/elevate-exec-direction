// resumo-diario-gestao: resumo comercial DIÁRIO do cliente, no tom do Marcelo,
// enviado SEMPRE no GRUPO DE GESTÃO do cliente (nunca no privado do dono).
// Lê os KPIs lançados no dia (kpi_entries) por empresa, compara com a média dos
// últimos 7 dias e a IA monta 5-7 linhas: números do dia, 1 alerta, 1 ação.
// Objetivo: virar hábito de gestão diário = anti-churn.
//
// Modos (body):
//   {} ou {test:true}  -> PREVIEW: gera e manda TUDO pro WhatsApp do Fabrício
//                          (com o nome de cada empresa), pra aprovar o conteúdo.
//   {live:true}        -> manda cada resumo pro GRUPO DE GESTÃO da empresa.
//   {companyId, live?} -> só uma empresa (preview por padrão).
//   {limit:N}          -> limita quantas empresas processa (default 8 no preview).
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_PHONE = "5531989840003"; // Fabrício (preview)
const MODEL = "claude-haiku-4-5";

function brToday(): string {
  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, "0")}-${String(br.getDate()).padStart(2, "0")}`;
}
function daysAgo(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/** Envia texto pela instância fabricionunnes (mesma do client-brain). number pode
 * ser telefone (preview) ou group_jid @g.us (grupo de gestão). */
async function sendWhatsApp(supabase: SupabaseClient, number: string, text: string): Promise<boolean> {
  try {
    let { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, api_url, api_key, status, provider_type")
      .eq("instance_name", "fabricionunnes")
      .eq("status", "connected")
      .maybeSingle();
    if (!inst) {
      const { data: fb } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, api_url, api_key, status, provider_type")
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

/** Grupo de gestão por company_id (projeto Marcelo, cross-account, só leitura). */
async function fetchGestaoGroups(): Promise<Map<string, { jid: string; name: string }>> {
  const MARCELO_URL = Deno.env.get("MARCELO_SUPABASE_URL") || "";
  const MARCELO_KEY = Deno.env.get("MARCELO_SERVICE_KEY") || "";
  const out = new Map<string, { jid: string; name: string }>();
  if (!MARCELO_URL || !MARCELO_KEY) return out;
  const mh = { apikey: MARCELO_KEY, Authorization: `Bearer ${MARCELO_KEY}` };
  const r = await fetch(`${MARCELO_URL}/rest/v1/marcelo_groups?select=company_id,group_jid,group_name,group_type`, { headers: mh });
  if (!r.ok) return out;
  const groups = await r.json();
  for (const g of groups || []) {
    if (!g.company_id || !g.group_jid) continue;
    const name = String(g.group_name || "");
    const type = String(g.group_type || "").toLowerCase();
    const isBoard = /unv\s*board/i.test(name);
    const isVend = /vend/i.test(type) || /vend/i.test(name);
    const isGestao = /gest/i.test(type) || (!isBoard && !isVend);
    if (!isGestao) continue;
    // Prefere um grupo com "gest" no tipo/nome; senão o primeiro não-board/não-vend.
    const prev = out.get(g.company_id);
    const strong = /gest/i.test(type) || /gest/i.test(name);
    if (!prev || strong) out.set(g.company_id, { jid: g.group_jid, name });
  }
  return out;
}

function classifyKpi(name: string): "faturamento" | "vendas" | "leads" | "atendimentos" | "reunioes" | "outro" {
  const n = name.toLowerCase();
  if (/(faturamento|faturado|receita)/.test(n)) return "faturamento";
  if (/(venda|fechamento)/.test(n)) return "vendas";
  if (/(lead|oportunidade|contato)/.test(n)) return "leads";
  if (/atendimento/.test(n)) return "atendimentos";
  if (/(reuni|call|agendamento)/.test(n)) return "reunioes";
  return "outro";
}

async function buildMetrics(supabase: SupabaseClient, companyId: string, today: string) {
  const { data: kpis } = await supabase
    .from("company_kpis").select("id, name, kpi_type")
    .eq("company_id", companyId).eq("is_active", true);
  if (!kpis?.length) return null;
  const kpiById = new Map(kpis.map((k: any) => [k.id, k]));
  const since = daysAgo(today, 7);

  const { data: entries } = await supabase
    .from("kpi_entries").select("kpi_id, entry_date, value")
    .eq("company_id", companyId).gte("entry_date", since).lte("entry_date", today);

  // Soma por KPI: hoje vs média diária dos 7 dias anteriores (exclui hoje).
  const todaySum = new Map<string, number>();
  const prevSum = new Map<string, number>();
  const prevDays = new Map<string, Set<string>>();
  for (const e of entries || []) {
    const v = Number(e.value || 0);
    if (e.entry_date === today) {
      todaySum.set(e.kpi_id, (todaySum.get(e.kpi_id) || 0) + v);
    } else {
      prevSum.set(e.kpi_id, (prevSum.get(e.kpi_id) || 0) + v);
      if (!prevDays.has(e.kpi_id)) prevDays.set(e.kpi_id, new Set());
      prevDays.get(e.kpi_id)!.add(e.entry_date);
    }
  }
  const hasToday = todaySum.size > 0;
  const rows: any[] = [];
  for (const k of kpis as any[]) {
    const tv = todaySum.get(k.id) || 0;
    const pDaysN = (prevDays.get(k.id)?.size) || 0;
    const avg = pDaysN > 0 ? (prevSum.get(k.id) || 0) / pDaysN : 0;
    if (tv === 0 && avg === 0) continue;
    rows.push({
      nome: k.name,
      cat: classifyKpi(k.name),
      monetario: k.kpi_type === "monetary",
      hoje: tv,
      media7d: Math.round(avg * 10) / 10,
      delta_pct: avg > 0 ? Math.round(((tv - avg) / avg) * 100) : null,
    });
  }
  return { hasToday, rows };
}

async function generateSummary(companyName: string, metrics: any): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return "";
  const linhas = metrics.rows.map((r: any) => {
    const val = r.monetario ? brl(r.hoje) : String(r.hoje);
    const med = r.monetario ? brl(r.media7d) : String(r.media7d);
    const d = r.delta_pct == null ? "s/ base" : `${r.delta_pct >= 0 ? "+" : ""}${r.delta_pct}% vs média`;
    return `- ${r.nome}: hoje ${val} (média 7d ${med}, ${d})`;
  }).join("\n");

  const prompt = `Você é Marcelo Almeida, diretor comercial da UNV que acompanha o time do cliente ${companyName} no grupo de gestão do WhatsApp. Escreva o RESUMO DO DIA pra mandar NO GRUPO agora.

Números lançados hoje (comparados com a média diária dos últimos 7 dias):
${linhas}

Regras de escrita:
- Tom de diretor comercial: direto, humano, sem emoji, sem enrolação, português do Brasil.
- 5 a 7 linhas no máximo. Comece com uma saudação curta ao time.
- Traga os números que importam (faturamento, vendas, leads/atendimentos).
- Destaque 1 ponto de atenção (a maior queda) OU 1 vitória (a maior alta).
- Termine com 1 ação concreta pra amanhã.
- Não invente número que não está na lista. Não use markdown, só texto corrido/linhas.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) return "";
  const data = await resp.json();
  return (data?.content?.[0]?.text || "").trim();
}

function nudgeText(companyName: string): string {
  return `Bom dia, time ${companyName}. Hoje ainda não chegaram os números do dia aqui pra mim. Lança os indicadores no sistema que eu te devolvo a leitura comercial (o que subiu, o que caiu e onde focar). Sem número, reunião vira achismo.`;
}

const MES_NOME = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

/** Dia 1º: fechamento do mês com as flags do time (base = meta do mês que fechou).
 * <70% = Red · 70–100% = Yellow · >100% = Green. Retorna "" se não há flags. */
async function monthlyFlagsBlock(supabase: SupabaseClient, companyId: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("get_salesperson_flags", { p_company_id: companyId });
    if (error || !Array.isArray(data) || !data.length) return "";
    const months = Array.from(new Set(data.map((r: any) => r.ref_month))).sort().reverse();
    const latest = months[0];
    const rows = (data as any[]).filter((r) => r.ref_month === latest && r.flag && r.flag !== "none");
    if (!rows.length) return "";
    const [y, m] = String(latest).split("-");
    const mesNome = MES_NOME[Number(m) - 1] || latest;
    const red = rows.filter((r) => r.flag === "red");
    const yellow = rows.filter((r) => r.flag === "yellow");
    const green = rows.filter((r) => r.flag === "green");
    const fmt = (r: any) => `${r.salesperson_name} (${r.pct}%)`;
    const linhas: string[] = [
      ``,
      `*Fechamento de ${mesNome}/${y} — flags do time:* ${green.length} Green, ${yellow.length} Yellow, ${red.length} Red.`,
    ];
    if (green.length) linhas.push(`Green Flag (bateu a meta): ${green.map(fmt).join(", ")}`);
    if (yellow.length) linhas.push(`Yellow Flag (70–100%): ${yellow.map(fmt).join(", ")}`);
    if (red.length) linhas.push(`Red Flag (abaixo de 70%): ${red.map(fmt).join(", ")} — esses precisam de plano de recuperação já na primeira semana.`);
    return linhas.join("\n");
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const live = body.live === true;
    const today = brToday();
    const limit = Number(body.limit) || (live ? 100 : 8);

    const gestaoGroups = await fetchGestaoGroups();

    // Empresas ativas alvo: com grupo de gestão (regra: nunca privado do dono).
    let companyQuery = supabase.from("onboarding_companies").select("id, name").eq("status", "active");
    if (body.companyId) companyQuery = companyQuery.eq("id", body.companyId);
    const { data: companies } = await companyQuery;

    // Modo relatório: só diz quem tem/não tem grupo de gestão, sem enviar nada.
    if (body.report === true) {
      const withGroup: string[] = [];
      const withoutGroup: string[] = [];
      for (const c of (companies || [])) {
        (gestaoGroups.get(c.id) ? withGroup : withoutGroup).push(c.name);
      }
      withGroup.sort(); withoutGroup.sort();
      return new Response(JSON.stringify({
        ok: true, mode: "report",
        total_ativas: (companies || []).length,
        com_grupo: withGroup.length, sem_grupo: withoutGroup.length,
        sem_grupo_lista: withoutGroup, com_grupo_lista: withGroup,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: any[] = [];
    let sent = 0;
    for (const c of (companies || [])) {
      const group = gestaoGroups.get(c.id);
      if (!group) { results.push({ company: c.name, skipped: "sem grupo de gestão" }); continue; }
      if (results.filter((r) => r.processed).length >= limit) break;

      const metrics = await buildMetrics(supabase, c.id, today);
      let text: string;
      if (!metrics || !metrics.hasToday || metrics.rows.length === 0) {
        text = nudgeText(c.name);
      } else {
        text = await generateSummary(c.name, metrics) || nudgeText(c.name);
      }

      // Dia 1º (ou {flags:true} pra testar): anexa o fechamento do mês com as
      // flags do time — vira o ritual mensal de cobrança no grupo de gestão.
      if (today.endsWith("-01") || body.flags === true) {
        const fb = await monthlyFlagsBlock(supabase, c.id);
        if (fb) text = `${text}\n${fb}`;
      }

      const target = live ? group.jid : ALERT_PHONE;
      const payload = live ? text : `*[PREVIEW · ${c.name} · grupo: ${group.name}]*\n\n${text}`;
      const ok = await sendWhatsApp(supabase, target, payload);
      if (ok) sent++;
      results.push({ company: c.name, processed: true, has_data: !!metrics?.hasToday, sent_to: live ? "grupo_gestao" : "fabricio_preview", ok });
    }

    return new Response(JSON.stringify({ ok: true, mode: live ? "live" : "preview", today, sent, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
