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
function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
/** Feriado nacional brasileiro? Recebe "YYYY-MM-DD" (data BRT). */
function isBrazilHoliday(dateStr: string): boolean {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const fixed = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
  const mmdd = `${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
  if (fixed.includes(mmdd)) return true;
  const easter = easterDate(y);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const offset = (n: number) => { const d = new Date(easter); d.setDate(d.getDate() + n); return key(d); };
  // Carnaval (seg/ter), Sexta-feira Santa, Corpus Christi
  return [offset(-48), offset(-47), offset(-2), offset(60)].includes(dateStr);
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
    .from("kpi_entries").select("kpi_id, entry_date, value, salesperson_id")
    .eq("company_id", companyId).gte("entry_date", since).lte("entry_date", today);

  // Quem lançou hoje x quem faltou (vendedores ativos da empresa)
  const { data: people } = await supabase
    .from("company_salespeople").select("id, name")
    .eq("company_id", companyId).eq("is_active", true);
  const launchedToday = new Set(
    (entries || []).filter((e: any) => e.entry_date === today && e.salesperson_id).map((e: any) => e.salesperson_id),
  );
  const lancaram = (people || []).filter((p: any) => launchedToday.has(p.id)).map((p: any) => String(p.name).trim());
  const faltaram = (people || []).filter((p: any) => !launchedToday.has(p.id)).map((p: any) => String(p.name).trim());

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
  return { hasToday, rows, lancaram, faltaram };
}

async function generateSummary(companyName: string, metrics: any, dayLabel = "hoje"): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return "";
  const linhas = metrics.rows.map((r: any) => {
    const val = r.monetario ? brl(r.hoje) : String(r.hoje);
    const med = r.monetario ? brl(r.media7d) : String(r.media7d);
    const d = r.delta_pct == null ? "s/ base" : `${r.delta_pct >= 0 ? "+" : ""}${r.delta_pct}% vs média`;
    return `- ${r.nome}: ${dayLabel} ${val} (média 7d ${med}, ${d})`;
  }).join("\n");

  const contexto = dayLabel !== "hoje"
    ? `Escreva o RESUMO do dia já fechado (${dayLabel}) pra mandar NO GRUPO agora de manhã — fale dos números como resultado de ${dayLabel}, nunca como "hoje".`
    : `Escreva o RESUMO DO DIA pra mandar NO GRUPO agora.`;
  const prompt = `Você é Marcelo Almeida, diretor comercial da UNV que acompanha o time do cliente ${companyName} no grupo de gestão do WhatsApp. ${contexto}

Números lançados ${dayLabel} (comparados com a média diária dos 7 dias anteriores):
${linhas}

Regras de escrita:
- Tom de diretor comercial: direto, humano, sem emoji, sem enrolação, português do Brasil.
- 5 a 7 linhas no máximo. Comece com uma saudação curta ao time.
- Traga os números que importam (faturamento, vendas, leads/atendimentos).
- Destaque 1 ponto de atenção (a maior queda) OU 1 vitória (a maior alta).
- Termine com 1 ação concreta pra ${dayLabel !== "hoje" ? "HOJE (o dia está começando)" : "amanhã"} — de EXECUÇÃO (ex: follow-up nos deals parados, revisar propostas em aberto, priorizar a lista de leads).
- NUNCA marque, prometa ou sugira reunião, call ou compromisso com dia/horário — você não tem acesso à agenda de ninguém. Se o dia pediu conversa, no máximo diga que o consultor vai alinhar com o time, sem hora marcada.
- Não invente número que não está na lista. Não use markdown, só texto corrido/linhas.
- Varie a construção do texto a cada dia — essa mensagem sai diariamente e não pode parecer repetida.`;

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
async function nudgeText(companyName: string, dayLabel = "hoje"): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return nudgeFallback(companyName);
  const periodo = brDayPeriod();
  const ref = dayLabel === "hoje" ? "de HOJE" : (dayLabel === "ontem" ? "de ONTEM" : "do SÁBADO");
  const prompt = `Você é Marcelo Almeida, diretor comercial da UNV, no grupo de gestão do cliente ${companyName} no WhatsApp. Os indicadores ${ref} não foram lançados no sistema. Escreva UMA cobrança curta (2 a 3 frases) pedindo pro time lançar os números ${ref}.

Regras:
- Deixe EXPLÍCITO logo no começo que NENHUM indicador foi lançado ${dayLabel} — zero lançamentos.
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
    const morning = body.morning === true;
    // Feriado nacional: ninguém está operando — nenhum resumo sai (nem noturno
    // nem matinal). Dry-run continua funcionando pra teste.
    if (!body.dry && isBrazilHoliday(brToday())) {
      return new Response(JSON.stringify({ ok: true, skipped: "feriado nacional", today: brToday() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Modo matinal fala do dia ANTERIOR; noturno fala do dia atual.
    // Na SEGUNDA o matinal fala do SÁBADO (D-2) — domingo a loja não opera
    // e o resultado de sábado não pode ficar sem leitura.
    const isMonday = new Date(brToday() + "T12:00:00").getDay() === 1;
    const today = morning ? daysAgo(brToday(), isMonday ? 2 : 1) : brToday();
    const dayLabel = morning ? (isMonday ? "no sábado" : "ontem") : "hoje";
    const limit = Number(body.limit) || (live ? 100 : 8);

    // Liga/desliga por empresa: painel "Automações" nos detalhes da empresa
    // (company_automation_settings). Sem linha na tabela = ligado.
    const { data: casRows } = await supabase
      .from("company_automation_settings")
      .select("company_id, enabled, variant")
      .eq("automation_key", "resumo_diario");
    const RESUMO_EXCLUDED_COMPANY_IDS = new Set<string>(
      (casRows || []).filter((r: any) => r.enabled === false).map((r: any) => r.company_id));
    // Regime matinal (11h, dia anterior) configurado no painel da empresa
    const MORNING_COMPANY_IDS = new Set<string>(
      (casRows || []).filter((r: any) => r.variant === "matinal").map((r: any) => r.company_id));

    const gestaoGroups = await fetchGestaoGroups();

    // Empresas ativas alvo: com grupo de gestão (regra: nunca privado do dono).
    let companyQuery = supabase.from("onboarding_companies").select("id, name").eq("status", "active");
    if (body.companyId) companyQuery = companyQuery.eq("id", body.companyId);
    const { data: companies } = await companyQuery;

    const results: any[] = [];
    let sent = 0;
    for (const c of (companies || [])) {
      if (RESUMO_EXCLUDED_COMPANY_IDS.has(c.id)) { results.push({ company: c.name, skipped: "desligada no painel de automações" }); continue; }
      // Empresas matinais só saem no run morning; as demais só no noturno.
      if (morning !== MORNING_COMPANY_IDS.has(c.id)) { results.push({ company: c.name, skipped: morning ? "não é matinal" : "resumo matinal próprio (10h)" }); continue; }
      const group = gestaoGroups.get(c.id);
      if (!group) { results.push({ company: c.name, skipped: "sem grupo de gestão" }); continue; }
      if (results.filter((r) => r.processed).length >= limit) break;

      const metrics = await buildMetrics(supabase, c.id, today);
      let text: string;
      if (!metrics || !metrics.hasToday || metrics.rows.length === 0) {
        text = await nudgeText(c.name, dayLabel);
      } else {
        text = await generateSummary(c.name, metrics, dayLabel) || await nudgeText(c.name, dayLabel);
        // Quem lançou / quem faltou: bloco DETERMINÍSTICO (direto do banco) —
        // a IA nunca escreve nomes, então nunca erra nem inventa.
        const parts: string[] = [];
        if (metrics.lancaram.length) parts.push(`Lançaram ${dayLabel}: ${metrics.lancaram.join(", ")}.`);
        if (metrics.faltaram.length) parts.push(morning
          ? `Faltou lançar ${dayLabel}: ${metrics.faltaram.join(", ")}. Sobe esses números retroativos ainda hoje cedo.`
          : `Faltou lançar: ${metrics.faltaram.join(", ")}. Bora subir esses números ainda hoje.`);
        if (parts.length) text += `\n\n${parts.join("\n")}`;
      }

      // Dia 1º (ou {flags:true} pra testar): anexa o fechamento do mês com as
      // flags do time — ritual mensal de cobrança no grupo de gestão.
      if (today.endsWith("-01") || body.flags === true) {
        const fb = await monthlyFlagsBlock(supabase, c.id);
        if (fb) text = `${text}\n${fb}`;
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
