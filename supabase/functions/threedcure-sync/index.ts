// threedcure-sync: preenche os KPIs da 3D Cure com os números do sistema
// interno da cliente (3D Cure HQ — "API de leitura do dashboard").
// Substitui o agendor-sync (set/2026). A API devolve o ACUMULADO do mês por
// CANAL (Time de vendas, Site, Shopee, ML, Amazon, MRS…) e a meta de cada
// canal. Modelo:
//   - cada canal vira uma linha em company_salespeople (criada na 1ª vez);
//   - se a API trouxer `faturamento.por_vendedora` (abertura do canal Time de
//     vendas por vendedora — pedido à cliente em 04/09), cada vendedora vira a
//     linha dela (casa com o cadastro real do Nexus pelo nome) e "Time de
//     vendas" fica só com o resíduo; com `quantidade` o KPI Vendas volta a ser
//     preenchido e reativado;
//   - a gente converge por DELTA: lança no dia de hoje a diferença entre o
//     acumulado da API e o que o Nexus já tem no mês pra aquela linha
//     (mesma mecânica do windash-sync; upsert na linha do dia, nunca duplica);
//   - resíduo entre total e soma dos canais vai pra linha "Sem canal";
//   - metas: company_kpis.target_value = meta_total; kpi_monthly_targets
//     (nível "Meta") por linha e no nível da empresa.
// Entrada: { competencia?: "YYYY-MM", mes_anterior?: boolean, dry_run?: boolean }
// Tempo real: o sistema da cliente chama POST/GET ...?t=<THREEDCURE_WEBHOOK_SECRET>
// (corpo vazio) toda vez que uma venda entra/muda — roda a mesma convergência.
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_ID = "6e94acf4-4888-4c1c-bacd-0861ced43a87"; // 3D CURE
const KPI_FATURAMENTO = "43a48342-4902-4864-a891-9e344fa101a8";
const KPI_VENDAS = "afc2f5d1-535a-4990-8735-6db6c0ec4051";
const API_URL = "https://gkokqywekmqfwprkicor.supabase.co/functions/v1/api-dashboard";
const TAG = "[3DCURE-HQ]";
const CANAL_TIME = "time_vendas";
const SEM_CANAL = "Sem canal";
const LEVEL_META = { level_name: "Meta", level_order: 1 };
// jul/ago-2026 ficaram no Nexus com a abertura por vendedora do Agendor — não
// reescrever por canal (dobraria o faturamento desses meses).
const PRIMEIRA_COMPETENCIA = "2026-09";

type Linha = {
  key: string;          // canal ou "vend:<nome>"
  rotulo: string;       // nome da linha no Nexus
  meta: number;         // meta de faturamento no mês
  realizado: number;    // faturamento acumulado no mês
  quantidade: number | null; // vendas (unidades) acumuladas, se a API der
  metaQuantidade: number | null;
  ordem: number;
  vendedora: boolean;   // casa por tokens com o cadastro real
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** casa "Karoliny Araújo" (API) com "Karoliny Stefany Gomes de Araujo" (Nexus) */
function matchByTokens<T extends { id: string; name: string }>(raw: string, list: T[]): T | null {
  const target = norm(raw);
  if (!target) return null;
  const exact = list.find((x) => norm(x.name) === target);
  if (exact) return exact;
  const tTok = target.split(" ").filter((t) => t.length > 2);
  const scored = list
    .map((x) => {
      const tok = norm(x.name).split(" ").filter((t) => t.length > 2);
      const shared = tok.filter((t) => tTok.includes(t));
      const firstOk = !!tok[0] && !!tTok[0] && tok[0] === tTok[0];
      return { item: x, score: shared.length + (firstOk ? 1 : 0), firstOk };
    })
    .filter((s) => s.firstOk && s.score >= 2)
    .sort((a, b) => b.score - a.score);
  if (scored.length && (scored.length === 1 || scored[0].score > scored[1].score)) return scored[0].item;
  return null;
}

/** "agora" em Brasília como data ISO (YYYY-MM-DD) */
const hojeBRT = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("THREEDCURE_API_TOKEN");
    if (!token) return json({ error: "THREEDCURE_API_TOKEN não configurado" }, 500);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // autorização: chave do projeto (cron/painel) OU segredo do webhook na query (?t=)
    const url = new URL(req.url);
    const t = url.searchParams.get("t") || "";
    const whSecret = Deno.env.get("THREEDCURE_WEBHOOK_SECRET") || "";
    const auth = req.headers.get("authorization") || "";
    const viaWebhook = !!whSecret && t === whSecret;
    if (!viaWebhook && !auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    if (t && !viaWebhook) return json({ error: "segredo inválido" }, 401);

    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const dryRun = !!body.dry_run;

    // competência: mês corrente (BRT) por padrão; mes_anterior pro reconcile do fechamento
    const hoje = hojeBRT();
    const mesAtual = hoje.slice(0, 7);
    let competencia: string = mesAtual;
    if (body.competencia && /^\d{4}-\d{2}$/.test(body.competencia)) competencia = body.competencia;
    else if (body.mes_anterior) {
      const [y, m] = mesAtual.split("-").map(Number);
      competencia = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    }
    if (competencia < PRIMEIRA_COMPETENCIA) {
      return json({ ok: true, skipped: true, competencia, motivo: `antes de ${PRIMEIRA_COMPETENCIA}: mês fechado com dados do Agendor por vendedora` });
    }
    const [ano, mes] = competencia.split("-").map(Number);
    const ehMesAtual = competencia === mesAtual;
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    const dia = ehMesAtual ? hoje : ultimoDia; // dia de lançamento
    const iniMes = `${competencia}-01`;

    // 1) API da cliente
    const resp = await fetch(`${API_URL}?ano=${ano}&mes=${mes}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return json({ error: `3D Cure HQ ${resp.status}: ${(await resp.text()).slice(0, 200)}` }, 502);
    const data = await resp.json();
    const fat = data?.faturamento || {};
    const totalApi = Number(fat.total) || 0;
    const porCanal: any[] = fat.por_canal || [];
    const porVendedora: any[] = Array.isArray(fat.por_vendedora) ? fat.por_vendedora : [];
    const configCanais: any[] = data?.canais || [];
    const metasCanais: Record<string, any> = data?.metas?.canais || {};
    const metaTotal = Number(data?.metas?.meta_total) || 0;

    // 2) linhas = canais (config ∪ por_canal) + vendedoras (se a API abrir) + resíduos
    const linhas = new Map<string, Linha>();
    const ordemDe = (c: any) => (c?.grupo === "mrs" ? 100 : 0) + (Number(c?.ordem) || 0);
    for (const c of configCanais) {
      const pct = c.pct_channel ? metasCanais[c.pct_channel] : null;
      linhas.set(c.canal, { key: c.canal, rotulo: c.rotulo || c.canal, meta: Number(pct?.meta) || 0, realizado: 0, quantidade: null, metaQuantidade: null, ordem: ordemDe(c), vendedora: false });
    }
    for (const c of porCanal) {
      const cur = linhas.get(c.canal) || { key: c.canal, rotulo: c.rotulo || c.canal, meta: 0, realizado: 0, quantidade: null, metaQuantidade: null, ordem: ordemDe(c), vendedora: false };
      cur.realizado = Number(c.realizado) || 0;
      if (Number(c.meta) > 0) cur.meta = Number(c.meta);
      if (num(c.quantidade) !== null) cur.quantidade = num(c.quantidade);
      linhas.set(c.canal, cur);
    }
    const somaCanais = Array.from(linhas.values()).reduce((s, c) => s + c.realizado, 0);
    const residuo = r2(totalApi - somaCanais);
    if (Math.abs(residuo) >= 0.5) {
      linhas.set("sem_canal", { key: "sem_canal", rotulo: SEM_CANAL, meta: 0, realizado: residuo, quantidade: null, metaQuantidade: null, ordem: 999, vendedora: false });
    }
    // abertura por vendedora: tira do canal "Time de vendas" e distribui
    let somaVendedoras = 0;
    let somaQtdVendedoras = 0;
    let temQuantidade = false;
    for (const v of porVendedora) {
      const nome = String(v.vendedora || v.nome || v.name || "").trim();
      if (!nome) continue;
      const realizado = Number(v.realizado ?? v.faturamento ?? v.valor) || 0;
      const qtd = num(v.quantidade ?? v.vendas ?? v.qtd);
      if (qtd !== null) { temQuantidade = true; somaQtdVendedoras += qtd; }
      somaVendedoras += realizado;
      linhas.set(`vend:${norm(nome)}`, {
        key: `vend:${norm(nome)}`, rotulo: nome, meta: Number(v.meta) || 0, realizado,
        quantidade: qtd, metaQuantidade: num(v.meta_quantidade ?? v.meta_vendas), ordem: 0.5, vendedora: true,
      });
    }
    const time = linhas.get(CANAL_TIME);
    if (time && porVendedora.length) {
      time.realizado = r2(time.realizado - somaVendedoras); // resíduo (idealmente 0)
      if (temQuantidade && time.quantidade !== null) time.quantidade = time.quantidade - somaQtdVendedoras;
      const somaMetasVend = porVendedora.reduce((s, v) => s + (Number(v.meta) || 0), 0);
      if (somaMetasVend > 0) time.meta = Math.max(0, r2(time.meta - somaMetasVend));
    }

    // 3) linha → "vendedor" do Nexus (canal casa exato pelo nome; vendedora casa por tokens; cria se faltar)
    const { data: sellers, error: eSellers } = await supabase
      .from("company_salespeople")
      .select("id, name, is_active, unit_id, team_id, sector_id")
      .eq("company_id", COMPANY_ID);
    if (eSellers) return json({ error: `company_salespeople: ${eSellers.message}` }, 500);
    const lista = (sellers || []) as any[];
    const byName = new Map(lista.map((s) => [norm(s.name), s]));
    const criados: string[] = [];
    const reativados: string[] = [];
    const spDaLinha = new Map<string, any>();
    for (const l of linhas.values()) {
      let sp = l.vendedora ? matchByTokens(l.rotulo, lista) : byName.get(norm(l.rotulo));
      if (!sp) {
        if (dryRun) { criados.push(l.rotulo); spDaLinha.set(l.key, { id: null, name: l.rotulo }); continue; }
        const { data: novo, error } = await supabase
          .from("company_salespeople")
          .insert({ company_id: COMPANY_ID, name: l.rotulo, access_code: genCode(), is_active: true })
          .select("id, name, is_active, unit_id, team_id, sector_id")
          .single();
        if (error) return json({ error: `criar linha ${l.rotulo}: ${error.message}` }, 500);
        sp = novo; lista.push(sp); byName.set(norm(l.rotulo), sp); criados.push(l.rotulo);
      } else if (l.vendedora && sp.is_active === false) {
        reativados.push(sp.name);
        if (!dryRun) await supabase.from("company_salespeople").update({ is_active: true }).eq("id", sp.id);
      }
      spDaLinha.set(l.key, sp);
    }

    // 4) KPIs a convergir: Faturamento sempre; Vendas quando a API traz quantidade
    const kpis: { kpiId: string; pick: (l: Linha) => number | null; nome: string }[] = [
      { kpiId: KPI_FATURAMENTO, pick: (l) => l.realizado, nome: "Faturamento" },
    ];
    if (temQuantidade) kpis.push({ kpiId: KPI_VENDAS, pick: (l) => l.quantidade, nome: "Vendas" });

    const spIds = Array.from(spDaLinha.values()).map((s) => s.id).filter(Boolean);
    const plano: { kpi: string; linha: string; api: number; outros: number; hojeAtual: number; valorHoje: number; sp: any; kpiId: string; key: string }[] = [];
    for (const k of kpis) {
      const outrosDias = new Map<string, number>();
      const noDia = new Map<string, number>();
      if (spIds.length) {
        const { data: rows, error } = await supabase
          .from("kpi_entries")
          .select("salesperson_id, entry_date, value")
          .eq("company_id", COMPANY_ID)
          .eq("kpi_id", k.kpiId)
          .in("salesperson_id", spIds)
          .gte("entry_date", iniMes)
          .lte("entry_date", ultimoDia)
          .limit(5000);
        if (error) return json({ error: `kpi_entries: ${error.message}` }, 500);
        for (const r of rows || []) {
          const id = r.salesperson_id as string;
          if (r.entry_date === dia) noDia.set(id, (noDia.get(id) || 0) + Number(r.value || 0));
          else outrosDias.set(id, (outrosDias.get(id) || 0) + Number(r.value || 0));
        }
      }
      for (const l of Array.from(linhas.values()).sort((a, b) => a.ordem - b.ordem)) {
        const api = k.pick(l);
        if (api === null) continue;
        const sp = spDaLinha.get(l.key);
        const outros = sp?.id ? outrosDias.get(sp.id) || 0 : 0;
        const hojeAtual = sp?.id ? noDia.get(sp.id) || 0 : 0;
        const valorHoje = r2(api - outros);
        if (Math.abs(valorHoje - hojeAtual) > 0.009) {
          plano.push({ kpi: k.nome, linha: l.rotulo, api, outros, hojeAtual, valorHoje, sp, kpiId: k.kpiId, key: l.key });
        }
      }
    }

    // 5) metas (só mexe se mudou)
    const metasPlano: { alvo: string; de: number | null; para: number }[] = [];
    const { data: kpiFat } = await supabase.from("company_kpis").select("target_value, is_active").eq("id", KPI_FATURAMENTO).single();
    if (ehMesAtual && metaTotal > 0 && Number(kpiFat?.target_value) !== metaTotal) {
      metasPlano.push({ alvo: "company_kpis.target_value (Faturamento)", de: Number(kpiFat?.target_value) || null, para: metaTotal });
      if (!dryRun) await supabase.from("company_kpis").update({ target_value: metaTotal }).eq("id", KPI_FATURAMENTO);
    }
    if (temQuantidade) {
      const { data: kpiVen } = await supabase.from("company_kpis").select("is_active").eq("id", KPI_VENDAS).single();
      if (kpiVen && kpiVen.is_active === false) {
        metasPlano.push({ alvo: "company_kpis.is_active (Vendas) reativado", de: 0, para: 1 });
        if (!dryRun) await supabase.from("company_kpis").update({ is_active: true }).eq("id", KPI_VENDAS);
      }
    }
    const alvos: { kpiId: string; salesperson_id: string | null; rotulo: string; meta: number }[] = [];
    if (metaTotal > 0) alvos.push({ kpiId: KPI_FATURAMENTO, salesperson_id: null, rotulo: "Empresa (meta total)", meta: metaTotal });
    for (const l of linhas.values()) {
      const sp = spDaLinha.get(l.key);
      if (!sp?.id) continue;
      alvos.push({ kpiId: KPI_FATURAMENTO, salesperson_id: sp.id, rotulo: l.rotulo, meta: l.meta });
      if (temQuantidade && l.metaQuantidade !== null) alvos.push({ kpiId: KPI_VENDAS, salesperson_id: sp.id, rotulo: `${l.rotulo} (vendas)`, meta: l.metaQuantidade });
    }
    const { data: mts } = await supabase
      .from("kpi_monthly_targets")
      .select("id, kpi_id, salesperson_id, target_value")
      .eq("company_id", COMPANY_ID)
      .in("kpi_id", [KPI_FATURAMENTO, KPI_VENDAS])
      .eq("month_year", competencia)
      .eq("level_order", LEVEL_META.level_order);
    const mtKey = (kpiId: string, spId: string | null) => `${kpiId}|${spId || "empresa"}`;
    const mtBy = new Map<string, any>((mts || []).map((m: any) => [mtKey(m.kpi_id, m.salesperson_id), m]));
    for (const a of alvos) {
      const ex = mtBy.get(mtKey(a.kpiId, a.salesperson_id));
      if (!ex && a.meta <= 0) continue; // sem meta e sem linha: nada a fazer
      if (ex && Math.abs(Number(ex.target_value) - a.meta) < 0.009) continue;
      metasPlano.push({ alvo: `meta ${competencia} · ${a.rotulo}`, de: ex ? Number(ex.target_value) : null, para: a.meta });
      if (dryRun) continue;
      if (ex) await supabase.from("kpi_monthly_targets").update({ target_value: a.meta }).eq("id", ex.id);
      else await supabase.from("kpi_monthly_targets").insert({
        company_id: COMPANY_ID, kpi_id: a.kpiId, month_year: competencia,
        salesperson_id: a.salesperson_id, target_value: a.meta, ...LEVEL_META,
      });
    }

    const resumo = {
      ok: true, dry_run: dryRun, via: viaWebhook ? "webhook" : "cron", competencia, dia,
      total_api: totalApi, soma_canais: r2(somaCanais), residuo, meta_total: metaTotal,
      linhas: linhas.size, vendedoras_na_api: porVendedora.length, com_quantidade: temQuantidade,
      criados, reativados,
      lancamentos: plano.map((p) => ({ kpi: p.kpi, linha: p.linha, api: p.api, ja_lancado_outros_dias: r2(p.outros), no_dia_antes: p.hojeAtual, no_dia_depois: p.valorHoje })),
      metas: metasPlano,
    };
    if (dryRun || plano.length === 0) return json({ ...resumo, gravados: 0 });

    // 6) upsert na linha do dia (UNIQUE vendedor+kpi+dia)
    const lote = plano.map((p) => ({
      company_id: COMPANY_ID,
      kpi_id: p.kpiId,
      salesperson_id: p.sp.id,
      entry_date: dia,
      value: p.valorHoje,
      unit_id: p.sp.unit_id ?? null,
      team_id: p.sp.team_id ?? null,
      sector_id: p.sp.sector_id ?? null,
      observations: `${TAG} sync automático do dashboard 3D Cure HQ · ${p.key}`,
    }));
    let gravados = 0;
    for (let i = 0; i < lote.length; i += 50) {
      const parte = lote.slice(i, i + 50);
      const { error } = await supabase.from("kpi_entries").upsert(parte, { onConflict: "salesperson_id,kpi_id,entry_date" });
      if (error) console.error("[threedcure-sync] upsert:", error.message);
      else gravados += parte.length;
    }
    return json({ ...resumo, gravados });
  } catch (err) {
    console.error("[threedcure-sync] erro:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
