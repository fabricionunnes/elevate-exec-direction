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

// Cobrança quando não há número lançado. NÃO pode ser idêntica todos os dias:
// a IA escreve um texto novo (com a saudação certa pro horário); se falhar,
// cai num pool rotacionado por dia+empresa.
function brDayPeriod(): "manhã" | "tarde" | "noite" {
  const h = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();
  return h < 12 ? "manhã" : h < 18 ? "tarde" : "noite";
}
const NUDGE_POOL: ((c: string, sauda: string) => string)[] = [
  (c, s) => `${s}, time ${c}. Os números de hoje ainda não chegaram aqui. Lança os indicadores no sistema que eu devolvo a leitura comercial de vocês. Gestão sem número é aposta.`,
  (c, s) => `${s}, ${c}. Dia fechando e o sistema ainda está sem os indicadores de hoje. Lança aí que eu te mostro o que subiu, o que caiu e onde focar amanhã.`,
  (c, s) => `${s}, time ${c}. Faltou o lançamento dos números de hoje. Sem eles eu não consigo devolver a leitura do dia — e a gente decide no escuro. Bora lançar.`,
  (c, s) => `${s}, ${c}. Ainda não vi os indicadores de hoje no sistema. Quem lança número todo dia enxerga o padrão antes do problema. Sobe aí que eu analiso.`,
  (c, s) => `${s}, time ${c}. Cadê os números de hoje? Lançou, eu leio e devolvo o direcionamento. Não lançou, a reunião vira opinião.`,
  (c, s) => `${s}, ${c}. O sistema está sem os lançamentos de hoje. Dois minutos pra lançar, e vocês ganham a leitura do dia de volta. Combinado?`,
  (c, s) => `${s}, time ${c}. Passando pra cobrar os indicadores do dia — ainda não caíram aqui. Número lançado é decisão embasada; sem ele é achismo.`,
  (c, s) => `${s}, ${c}. Hoje o painel ficou em branco até agora. Lança os números que eu te devolvo onde apertar amanhã. Consistência no lançamento é metade da gestão.`,
];
function nudgeFallback(companyName: string): string {
  const sauda = { manhã: "Bom dia", tarde: "Boa tarde", noite: "Boa noite" }[brDayPeriod()];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  let hash = 0;
  for (const ch of companyName) hash = (hash + ch.charCodeAt(0)) % 997;
  return NUDGE_POOL[(dayOfYear + hash) % NUDGE_POOL.length](companyName, sauda);
}
async function nudgeText(companyName: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return nudgeFallback(companyName);
  const periodo = brDayPeriod();
  const prompt = `Você é Marcelo Almeida, diretor comercial da UNV, no grupo de gestão do cliente ${companyName} no WhatsApp. Os indicadores de HOJE ainda não foram lançados no sistema. Escreva UMA cobrança curta (2 a 3 frases) pedindo pro time lançar os números do dia.

Regras:
- Agora é ${periodo} — use a saudação certa (ou nenhuma).
- Tom de diretor comercial: direto, humano, sem emoji, sem markdown, português do Brasil.
- Diga que com os números você devolve a leitura comercial (o que subiu, o que caiu, onde focar).
- VARIE a construção: essa mensagem sai todo dia e NÃO pode parecer repetida. Não use a frase "Sem número, reunião vira achismo".
- Responda SÓ com o texto final da mensagem.`;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, temperature: 1, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) return nudgeFallback(companyName);
    const data = await resp.json();
    const text = (data?.content?.[0]?.text || "").trim();
    return text.length > 30 ? text : nudgeFallback(companyName);
  } catch {
    return nudgeFallback(companyName);
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

    const results: any[] = [];
    let sent = 0;
    for (const c of (companies || [])) {
      const group = gestaoGroups.get(c.id);
      if (!group) { results.push({ company: c.name, skipped: "sem grupo de gestão" }); continue; }
      if (results.filter((r) => r.processed).length >= limit) break;

      const metrics = await buildMetrics(supabase, c.id, today);
      let text: string;
      if (!metrics || !metrics.hasToday || metrics.rows.length === 0) {
        text = await nudgeText(c.name);
      } else {
        text = await generateSummary(c.name, metrics) || await nudgeText(c.name);
      }

      // {dry:true}: só retorna os textos, não envia nada (validação).
      if (body.dry) {
        results.push({ company: c.name, processed: true, has_data: !!metrics?.hasToday, preview: text });
        continue;
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
