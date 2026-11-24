// kpi-planilha-diaria: a gestão do cliente manda no grupo o print do quadro "Acompanhamento de
// vendas diário" (vendido no dia e vendido total por consultor). Esta função lê o print, confere os
// totais e deixa o Nexus igual ao quadro: o lançamento do dia de cada consultor = "vendido dia" e o
// acumulado do mês = "vendido total". Depois chama o resumo do dia no grupo de gestão.
//
// Só roda pra empresa com company_automation_settings (automation_key = 'planilha_diaria', enabled).
// Quem chama: marcelo-webhook (projeto Marcelo), com x-api-key da api_keys, ou a chave de serviço.
//
// Corpo: { company_id, image_base64, image_mime?, dry?, entry_date?, received_at?, origem?, sem_resumo? }
//   dry: true     → só simula (não grava, não cadastra, não avisa, não manda resumo)
//   entry_date    → força o dia do lançamento (YYYY-MM-DD); padrão: hoje, ou ontem se chegou antes das 10h
//   sem_resumo    → grava mas não dispara o resumo no grupo
//
// Regras de segurança dos números (nada é gravado se alguma falhar; vira aviso pro Fabrício):
//   1. soma do "vendido total" das linhas = "vendido no mês" do cabeçalho
//   2. soma do "vendido dia" das linhas = "vendido no dia" do cabeçalho
//   3. mês do título = mês do lançamento
//   4. cada linha casa com um único consultor do cadastro (nome ambíguo trava)
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TOL = 0.06; // centavos de arredondamento na soma
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[R$\s]/g, "");
  if (!s || s === "-") return 0;
  // "1.064,92" → 1064.92 ; "1064.92" fica
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
};
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const semAcento = (t: unknown) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** tokens de nome: só letras, sem acento, com 2 letras ou mais ("Isabela G." → ["isabela"]) */
const toks = (t: unknown) => semAcento(t).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((x) => x.length >= 2);
const titulo = (t: string) => t.trim().toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase());

function brNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
function diaAnterior(s: string): string {
  const d = new Date(s + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return iso(d);
}

type Linha = { nome: string; meta_dia: number | null; vendido_dia: number; vendido_total: number };
type Leitura = { tipo: string; mes: string | null; meta_dia: number | null; vendido_dia: number | null; vendido_mes: number | null; linhas: Linha[] };

const PROMPT = `Esta imagem pode ser o quadro "Acompanhamento de vendas diário" de um time comercial: um cabeçalho com Meta do dia, Vendido no dia, Falta dia e Vendido no mês, e uma tabela por consultor com Meta dia, Vendido dia, Falta, Resultado, Vendido total e Projeção.

Se NÃO for esse tipo de quadro (foto, print de conversa, outro relatório, tabela sem "vendido total" por consultor), responda só {"tipo":"outro"}.

Se for, responda APENAS um JSON neste formato:
{"tipo":"acompanhamento_vendas","mes":"NOVEMBRO","meta_dia":9283.34,"vendido_dia":4407.67,"vendido_mes":44299.96,"linhas":[{"nome":"ANA LUIZA","meta_dia":1064.92,"vendido_dia":2148.49,"vendido_total":15110.49}]}

Regras:
- Uma entrada em "linhas" por consultor, na ordem do quadro, sem pular nenhuma (inclusive as zeradas). Não inclua linha de total nem o rodapé.
- Copie os números exatamente como estão escritos, sem somar nem corrigir. Use ponto como decimal, sem "R$" e sem separador de milhar (R$ 15.110,49 vira 15110.49).
- "-" ou célula vazia em vendido_dia ou vendido_total vira 0. "-" em meta_dia vira null.
- "mes" é o mês escrito no título do quadro (null se não aparecer).
- "meta_dia", "vendido_dia" e "vendido_mes" de fora da lista são os do cabeçalho do quadro (null se não aparecerem).
- Responda somente o JSON.`;

function logUsoIA(model: string, usage: any, meta?: Record<string, unknown>) {
  try {
    fetch(`${SUPABASE_URL}/rest/v1/ai_usage_log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({
        fn: "kpi-planilha-diaria", model,
        input_tokens: usage?.input_tokens ?? 0, output_tokens: usage?.output_tokens ?? 0,
        cache_read_tokens: usage?.cache_read_input_tokens ?? 0, cache_write_tokens: usage?.cache_creation_input_tokens ?? 0,
        meta: meta ?? null,
      }),
    }).catch(() => {});
  } catch { /* medidor nunca derruba a função */ }
}

/** Lê o print: Anthropic primeiro; se falhar (sem crédito, fora do ar), OpenAI. Devolve o texto cru e o modelo. */
async function lerImagem(base64: string, mime: string): Promise<{ texto: string; modelo: string }> {
  const erros: string[] = [];
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (ANTHROPIC_API_KEY) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-5", max_tokens: 3000,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
            { type: "text", text: PROMPT },
          ] }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        logUsoIA("claude-sonnet-5", (data as any)?.usage);
        const t = String(data?.content?.find((c: any) => c.type === "text")?.text || "").trim();
        if (t) return { texto: t, modelo: "claude-sonnet-5" };
        erros.push("Anthropic sem texto");
      } else erros.push(`Anthropic ${resp.status} ${(await resp.text()).slice(0, 120)}`);
    } catch (e) { erros.push(`Anthropic ${String(e).slice(0, 120)}`); }
  }
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (OPENAI_API_KEY) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o", max_tokens: 3000, temperature: 0, response_format: { type: "json_object" },
          messages: [{ role: "user", content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}`, detail: "high" } },
          ] }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const u = (data as any)?.usage;
        logUsoIA("gpt-4o", { input_tokens: u?.prompt_tokens ?? 0, output_tokens: u?.completion_tokens ?? 0 }, { reserva: true });
        const t = String(data?.choices?.[0]?.message?.content || "").trim();
        if (t) return { texto: t, modelo: "gpt-4o" };
        erros.push("OpenAI sem texto");
      } else erros.push(`OpenAI ${resp.status} ${(await resp.text()).slice(0, 120)}`);
    } catch (e) { erros.push(`OpenAI ${String(e).slice(0, 120)}`); }
  }
  throw new Error(`nenhuma IA leu a imagem: ${erros.join(" | ") || "sem chave configurada"}`);
}

function interpretar(texto: string): Leitura | null {
  try {
    const m = texto.match(/\{[\s\S]*\}/);
    const p = JSON.parse(m?.[0] || texto);
    if (!p || typeof p !== "object") return null;
    const linhas: Linha[] = Array.isArray(p.linhas)
      ? p.linhas.filter((l: any) => l && String(l.nome || "").trim()).map((l: any) => ({
        nome: String(l.nome).trim(),
        meta_dia: l.meta_dia == null || l.meta_dia === "-" ? null : r2(num(l.meta_dia)),
        vendido_dia: r2(num(l.vendido_dia)),
        vendido_total: r2(num(l.vendido_total)),
      }))
      : [];
    return {
      tipo: String(p.tipo || "outro"),
      mes: p.mes ? String(p.mes) : null,
      meta_dia: p.meta_dia == null ? null : r2(num(p.meta_dia)),
      vendido_dia: p.vendido_dia == null ? null : r2(num(p.vendido_dia)),
      vendido_mes: p.vendido_mes == null ? null : r2(num(p.vendido_mes)),
      linhas,
    };
  } catch { return null; }
}

type Pessoa = { id: string; name: string; is_active: boolean | null; unit_id: string | null; team_id: string | null; sector_id: string | null };

/** Casa o nome do quadro com o cadastro: nome inteiro igual; senão prefixo único. Ativos primeiro. */
function casar(nome: string, pessoas: Pessoa[]): { p?: Pessoa; ambiguo?: boolean } {
  const pt = toks(nome);
  if (!pt.length) return {};
  const chave = pt.join(" ");
  const grupos = [pessoas.filter((p) => p.is_active !== false), pessoas.filter((p) => p.is_active === false)];
  for (const g of grupos) {
    const exato = g.filter((p) => toks(p.name).join(" ") === chave);
    if (exato.length === 1) return { p: exato[0] };
    if (exato.length > 1) return { ambiguo: true };
  }
  for (const g of grupos) {
    const c = g.filter((p) => {
      const st = toks(p.name);
      const n = Math.min(st.length, pt.length);
      return n > 0 && st.slice(0, n).join(" ") === pt.slice(0, n).join(" ");
    });
    if (c.length === 1) return { p: c[0] };
    if (c.length > 1) return { ambiguo: true };
  }
  return {};
}

async function autorizado(req: Request, supabase: SupabaseClient): Promise<boolean> {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (bearer && bearer === SERVICE_ROLE) return true;
  const apiKey = (req.headers.get("x-api-key") || "").trim();
  if (!apiKey) return false;
  const { data } = await supabase.from("api_keys").select("id, tenant_id").eq("key", apiKey).eq("is_active", true).maybeSingle();
  return !!data && (data as any).tenant_id == null; // só a chave da própria UNV
}

// Central de Avisos: o título fica fixo por tipo (vale o do primeiro aviso), então a empresa vai no texto.
async function avisar(supabase: SupabaseClient, cabecalho: string, texto: string) {
  try {
    await supabase.rpc("aviso_enviar", { p_tipo: "planilha_diaria", p_texto: `*${cabecalho}*\n${texto}`, p_titulo: "Planilha diária de vendas (quadro do grupo)", p_origem: "nexus", p_nivel_padrao: "hora" });
  } catch (e) { console.error("aviso_enviar", String(e)); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "use POST" }, 405);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  if (!(await autorizado(req, supabase))) return json({ ok: false, error: "não autorizado" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "JSON inválido" }, 400); }
  const companyId = String(body?.company_id || "");
  const base64 = String(body?.image_base64 || "").replace(/^data:[^;]+;base64,/, "");
  const mime = String(body?.image_mime || "image/jpeg").split(";")[0];
  const dry = body?.dry === true;
  if (!companyId || !base64) return json({ ok: false, error: "company_id e image_base64 são obrigatórios" }, 400);

  // 1) a empresa precisa ter a automação ligada (antes de gastar leitura de imagem)
  const { data: cfg } = await supabase.from("company_automation_settings").select("enabled")
    .eq("company_id", companyId).eq("automation_key", "planilha_diaria").maybeSingle();
  if (!cfg || cfg.enabled !== true) return json({ ok: false, reason: "desligada" });
  const { data: company } = await supabase.from("onboarding_companies").select("id, name").eq("id", companyId).maybeSingle();
  if (!company) return json({ ok: false, reason: "empresa não encontrada" }, 404);

  const registrar = async (status: string, entryDate: string | null, leitura: Leitura | null, resultado: unknown) => {
    if (dry) return;
    const { error } = await supabase.from("kpi_planilha_log").insert({
      company_id: companyId, entry_date: entryDate, status,
      vendido_dia: leitura?.vendido_dia ?? null, vendido_mes: leitura?.vendido_mes ?? null,
      leitura, resultado, origem: body?.origem ? String(body.origem).slice(0, 200) : null,
    });
    if (error) console.error("kpi_planilha_log", error.message);
  };

  try {
    // 2) leitura do print
    const { texto, modelo } = await lerImagem(base64, mime);
    const leitura = interpretar(texto);
    if (!leitura || leitura.tipo !== "acompanhamento_vendas" || !leitura.linhas.length) {
      await registrar("outro", null, null, { modelo }); // imagem qualquer no grupo: só registra, sem aviso
      return json({ ok: false, reason: "nao_e_planilha", modelo });
    }

    // 3) dia do lançamento
    const agora = brNow();
    const recebida = body?.received_at ? new Date(new Date(body.received_at).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })) : agora;
    const hoje = iso(agora);
    let dia = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.entry_date || "")) ? String(body.entry_date) : iso(recebida);
    if (!body?.entry_date && recebida.getHours() < 10) dia = diaAnterior(dia); // fechamento mandado na manhã seguinte
    const mesIni = dia.slice(0, 8) + "01";
    const fim = new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)), 0);
    const mesFim = iso(fim);
    const ontem = dia === mesIni ? null : diaAnterior(dia);

    // 4) conferências
    const problemas: string[] = [];
    const somaTotal = r2(leitura.linhas.reduce((s, l) => s + l.vendido_total, 0));
    const somaDia = r2(leitura.linhas.reduce((s, l) => s + l.vendido_dia, 0));
    if (leitura.vendido_mes == null) problemas.push(`o print não mostra o "vendido no mês" do cabeçalho, então não dá pra conferir a soma (as linhas somam ${brl(somaTotal)})`);
    else if (Math.abs(somaTotal - leitura.vendido_mes) > TOL) problemas.push(`a soma do "vendido total" das linhas (${brl(somaTotal)}) não bate com o "vendido no mês" do cabeçalho (${brl(leitura.vendido_mes)})`);
    if (leitura.vendido_dia != null && Math.abs(somaDia - leitura.vendido_dia) > TOL) problemas.push(`a soma do "vendido dia" das linhas (${brl(somaDia)}) não bate com o "vendido no dia" do cabeçalho (${brl(leitura.vendido_dia)})`);
    const mesEsperado = MESES[Number(dia.slice(5, 7)) - 1];
    if (leitura.mes && semAcento(leitura.mes).trim() !== semAcento(mesEsperado)) problemas.push(`o título do quadro diz ${leitura.mes.toUpperCase()}, e o lançamento seria em ${mesEsperado} (${ddmm(dia)})`);
    if (leitura.linhas.some((l) => l.vendido_dia < 0 || l.vendido_total < 0)) problemas.push("há valor negativo em alguma linha");

    // 5) cadastro e indicador
    const [{ data: pessoasRaw }, { data: kpisRaw }] = await Promise.all([
      supabase.from("company_salespeople").select("id, name, is_active, unit_id, team_id, sector_id").eq("company_id", companyId),
      supabase.from("company_kpis").select("id, name, kpi_type, is_main_goal, sector_id, sort_order").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
    ]);
    const pessoas = (pessoasRaw || []) as Pessoa[];
    const monet = (kpisRaw || []).filter((k: any) => k.kpi_type === "monetary");
    const kpi: any = monet.find((k: any) => k.is_main_goal && /faturamento/i.test(k.name)) || monet.find((k: any) => k.is_main_goal)
      || monet.find((k: any) => /faturamento/i.test(k.name)) || monet[0];
    if (!kpi) problemas.push("a empresa não tem indicador em R$ ativo pra receber o faturamento");

    const casadas: { linha: Linha; p?: Pessoa; novo?: boolean }[] = [];
    const usados = new Map<string, string>();
    const semCadastroZerado: string[] = [];
    for (const linha of leitura.linhas) {
      const r = casar(linha.nome, pessoas);
      if (r.ambiguo) { problemas.push(`o nome "${linha.nome}" casa com mais de um consultor do cadastro`); continue; }
      if (r.p) {
        if (usados.has(r.p.id)) { problemas.push(`"${linha.nome}" e "${usados.get(r.p.id)}" caíram no mesmo cadastro (${r.p.name})`); continue; }
        usados.set(r.p.id, linha.nome);
        casadas.push({ linha, p: r.p });
      } else if (linha.vendido_total !== 0 || linha.vendido_dia !== 0) casadas.push({ linha, novo: true });
      else semCadastroZerado.push(linha.nome);
    }

    if (problemas.length) {
      const resultado = { problemas, dia, modelo };
      await registrar("bloqueada", dia, leitura, resultado);
      if (!dry) await avisar(supabase, `Planilha de vendas da ${company.name} não foi lançada`,
        `Recebi o quadro de vendas da ${company.name} no grupo, mas não lancei nada porque:\n- ${problemas.join("\n- ")}\n\nO Nexus ficou como estava. Se for erro de leitura, pede pra reenviar o print inteiro e nítido.`);
      return json({ ok: false, reason: "bloqueada", ...resultado, leitura });
    }

    // 6) situação do mês no Nexus (pagina de 1000 em 1000)
    type Ent = { id: string; salesperson_id: string; entry_date: string; value: number; observations: string | null; unit_id: string | null; team_id: string | null; sector_id: string | null };
    const ents: Ent[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("kpi_entries")
        .select("id, salesperson_id, entry_date, value, observations, unit_id, team_id, sector_id")
        .eq("company_id", companyId).eq("kpi_id", kpi.id).gte("entry_date", mesIni).lte("entry_date", mesFim)
        .order("id").range(from, from + 999);
      if (error) throw new Error(`leitura dos lançamentos: ${error.message}`);
      ents.push(...((data || []) as Ent[]));
      if (!data || data.length < 1000) break;
    }
    const totalAntes = r2(ents.reduce((s, e) => s + Number(e.value || 0), 0));
    const porPessoa = new Map<string, { outros: number; noDia?: Ent; naVespera?: Ent }>();
    for (const e of ents) {
      const a = porPessoa.get(e.salesperson_id) || { outros: 0 };
      if (e.entry_date === dia) a.noDia = e;
      else {
        a.outros += Number(e.value || 0);
        if (ontem && e.entry_date === ontem) a.naVespera = e;
      }
      porPessoa.set(e.salesperson_id, a);
    }

    // 7) cadastra quem está no quadro com venda e não existe no Nexus
    const cadastrados: string[] = [];
    for (const c of casadas) {
      if (!c.novo) continue;
      const nome = titulo(c.linha.nome);
      if (dry) { c.p = { id: `novo:${nome}`, name: nome, is_active: true, unit_id: null, team_id: null, sector_id: null }; cadastrados.push(nome); continue; }
      const { data: novo, error } = await supabase.from("company_salespeople").insert({ company_id: companyId, name: nome }).select("id, name, is_active, unit_id, team_id, sector_id").single();
      if (error || !novo) throw new Error(`cadastro de ${nome}: ${error?.message || "sem retorno"}`);
      c.p = novo as Pessoa;
      cadastrados.push(nome);
    }

    // 8) monta os lançamentos: dia = "vendido dia"; a diferença do acumulado vai na véspera
    const marca = `[PLANILHA AUTO ${ddmm(dia)}]`;
    const gravar: any[] = [];
    const mudancas: any[] = [];
    const planejar = (p: Pessoa, vendDia: number, vendTotal: number, motivo: string) => {
      const a = porPessoa.get(p.id) || { outros: 0 };
      const base = { company_id: companyId, salesperson_id: p.id, kpi_id: kpi.id };
      const loc = (e?: Ent) => ({ unit_id: e?.unit_id ?? p.unit_id ?? null, team_id: e?.team_id ?? p.team_id ?? null, sector_id: e?.sector_id ?? kpi.sector_id ?? p.sector_id ?? null });
      const ajuste = r2(vendTotal - vendDia - r2(a.outros));
      let valorDia = vendDia;
      if (!ontem && Math.abs(ajuste) >= 0.01) valorDia = r2(vendDia + ajuste); // dia 1º: não há véspera no mês
      const atualDia = a.noDia ? r2(Number(a.noDia.value || 0)) : null;
      if ((atualDia == null && valorDia !== 0) || (atualDia != null && Math.abs(atualDia - valorDia) >= 0.01)) {
        gravar.push({ ...base, ...loc(a.noDia), entry_date: dia, value: valorDia, observations: `${marca} ${motivo}` });
        mudancas.push({ nome: p.name, data: dia, de: atualDia, para: valorDia });
      }
      if (ontem && Math.abs(ajuste) >= 0.01) {
        const atual = a.naVespera ? r2(Number(a.naVespera.value || 0)) : 0;
        const novoValor = r2(atual + ajuste);
        const nota = `${marca} Ajuste do acumulado (${ajuste > 0 ? "+" : "-"}${brl(Math.abs(ajuste))}) pra fechar com o quadro do grupo`;
        const obs = a.naVespera?.observations ? `${a.naVespera.observations} | ${nota}`.slice(0, 600) : nota;
        gravar.push({ ...base, ...loc(a.naVespera), entry_date: ontem, value: novoValor, observations: obs });
        mudancas.push({ nome: p.name, data: ontem, de: a.naVespera ? atual : null, para: novoValor, ajuste });
      }
    };
    for (const c of casadas) planejar(c.p!, c.linha.vendido_dia, c.linha.vendido_total, "Venda do dia conforme o quadro enviado no grupo");
    // quem tem valor no mês e não está no quadro: o quadro é a fonte, então zera (ex.: venda transferida)
    const noQuadro = new Set(casadas.map((c) => c.p!.id));
    const zerados: string[] = [];
    for (const p of pessoas) {
      if (noQuadro.has(p.id)) continue;
      const a = porPessoa.get(p.id);
      if (!a) continue;
      const soma = r2(a.outros + Number(a.noDia?.value || 0));
      if (Math.abs(soma) < 0.01 && !(a.noDia && Math.abs(Number(a.noDia.value || 0)) >= 0.01)) continue;
      planejar(p, 0, 0, "Fora do quadro enviado no grupo");
      zerados.push(`${p.name} (${brl(soma)})`);
    }

    // 9) grava e confere
    if (!dry && gravar.length) {
      const { error } = await supabase.from("kpi_entries").upsert(gravar, { onConflict: "salesperson_id,kpi_id,entry_date" });
      if (error) throw new Error(`gravação: ${error.message}`);
    }
    let totalDepois = r2(totalAntes + mudancas.reduce((s, m) => s + (Number(m.para) - Number(m.de || 0)), 0));
    if (!dry) {
      const { data: conf } = await supabase.from("kpi_entries").select("value").eq("company_id", companyId).eq("kpi_id", kpi.id).gte("entry_date", mesIni).lte("entry_date", mesFim).range(0, 4999);
      if (conf) totalDepois = r2(conf.reduce((s: number, e: any) => s + Number(e.value || 0), 0));
    }
    const fechou = leitura.vendido_mes == null || Math.abs(totalDepois - leitura.vendido_mes) <= TOL;

    const planilha = {
      dia, meta_dia: leitura.meta_dia, vendido_dia: leitura.vendido_dia ?? somaDia, vendido_mes: leitura.vendido_mes ?? somaTotal,
      linhas: casadas.map((c) => ({ nome: c.p!.name, meta_dia: c.linha.meta_dia, vendido_dia: c.linha.vendido_dia, vendido_total: c.linha.vendido_total }))
        .concat(semCadastroZerado.map((n) => ({ nome: titulo(n), meta_dia: null, vendido_dia: 0, vendido_total: 0 }))),
    };
    const resultado: any = {
      dia, indicador: kpi.name, modelo, total_antes: totalAntes, total_depois: totalDepois, vendido_mes: planilha.vendido_mes, fechou,
      lancamentos: gravar.length, mudancas, cadastrados, zerados, sem_cadastro_zerado: semCadastroZerado,
    };

    // 10) resumo do dia no grupo: só quando o quadro é de hoje e chegou perto do fechamento
    if (!dry && fechou && body?.sem_resumo !== true && dia === hoje) {
      const { data: rs } = await supabase.from("company_automation_settings").select("enabled, send_time, variant")
        .eq("company_id", companyId).eq("automation_key", "resumo_diario").maybeSingle();
      const sendTime = (rs as any)?.send_time || ((rs as any)?.variant === "matinal" ? "11:00" : "19:30");
      const [h, m] = String(sendTime).split(":").map(Number);
      const alvo = (h || 0) * 60 + (m || 0);
      const minAgora = agora.getHours() * 60 + agora.getMinutes();
      if ((rs as any)?.enabled === false) resultado.resumo = "desligado no painel";
      else if (alvo < 14 * 60) resultado.resumo = "resumo matinal: sai amanhã cedo com estes números";
      else if (minAgora < alvo - 150) resultado.resumo = "parcial do dia: resumo só com o quadro do fim da tarde";
      else {
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/resumo-diario-gestao`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
            body: JSON.stringify({ aposPlanilha: true, companyId, planilha }),
          });
          resultado.resumo = await resp.json().catch(() => ({ status: resp.status }));
        } catch (e) { resultado.resumo = { erro: String(e).slice(0, 200) }; }
      }
    }

    await registrar(fechou ? "ok" : "divergente", dia, leitura, resultado);
    if (!dry && (cadastrados.length || zerados.length || !fechou)) {
      const partes: string[] = [];
      if (cadastrados.length) partes.push(`Cadastrei no Nexus quem estava no quadro e não existia: ${cadastrados.join(", ")}.`);
      if (zerados.length) partes.push(`Zerei no mês quem tinha valor no Nexus e não está no quadro: ${zerados.join(", ")}.`);
      if (!fechou) partes.push(`Atenção: depois de lançar, o mês no Nexus ficou em ${brl(totalDepois)} e o quadro diz ${brl(planilha.vendido_mes)}.`);
      await avisar(supabase, `Planilha de vendas da ${company.name} (${ddmm(dia)})`, partes.join("\n"));
    }
    return json({ ok: true, dry, ...resultado, planilha });
  } catch (e) {
    const msg = String((e as any)?.message || e).slice(0, 400);
    console.error("kpi-planilha-diaria", msg);
    await registrar("erro", null, null, { erro: msg });
    if (!dry) await avisar(supabase, `Planilha de vendas da ${company.name}: erro ao lançar`, `Não consegui processar o quadro de vendas da ${company.name} enviado no grupo.\nMotivo: ${msg}`);
    return json({ ok: false, error: msg }, 500);
  }
});
