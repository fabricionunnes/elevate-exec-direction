// threedcure-sync: preenche o KPI Faturamento da 3D Cure com os números do
// sistema interno da cliente (3D Cure HQ — "API de leitura do dashboard").
// Substitui o agendor-sync (out/2026). A API devolve o ACUMULADO do mês por
// CANAL (Time de vendas, Site, Shopee, ML, Amazon, MRS…) e a meta de cada
// canal; não há abertura por vendedora nem por dia. Modelo:
//   - cada canal vira uma linha em company_salespeople (criada na 1ª vez);
//   - a gente converge por DELTA: lança no dia de hoje a diferença entre o
//     acumulado da API e o que o Nexus já tem no mês pra aquele canal
//     (mesma mecânica do windash-sync; upsert na linha do dia, nunca duplica);
//   - resíduo entre total e soma dos canais vai pra linha "Sem canal";
//   - metas: company_kpis.target_value = meta_total; kpi_monthly_targets
//     (nível "Meta") por canal e no nível da empresa.
// Entrada: { competencia?: "YYYY-MM", mes_anterior?: boolean, dry_run?: boolean }
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_ID = "6e94acf4-4888-4c1c-bacd-0861ced43a87"; // 3D CURE
const KPI_FATURAMENTO = "43a48342-4902-4864-a891-9e344fa101a8";
const API_URL = "https://gkokqywekmqfwprkicor.supabase.co/functions/v1/api-dashboard";
const TAG = "[3DCURE-HQ]";
const SEM_CANAL = { canal: "sem_canal", rotulo: "Sem canal" };
const LEVEL_META = { level_name: "Meta", level_order: 1 };
// jul/ago-2026 ficaram no Nexus com a abertura por vendedora do Agendor — não
// reescrever por canal (dobraria o faturamento desses meses).
const PRIMEIRA_COMPETENCIA = "2026-09";

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

/** "agora" em Brasília como data ISO (YYYY-MM-DD) */
function hojeBRT(): string {
  return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("THREEDCURE_API_TOKEN");
    if (!token) return json({ error: "THREEDCURE_API_TOKEN não configurado" }, 500);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
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
    // dia de lançamento: hoje (mês corrente) ou último dia do mês (mês fechado)
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    const dia = ehMesAtual ? hoje : ultimoDia;
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
    const configCanais: any[] = data?.canais || [];
    const metasCanais: Record<string, any> = data?.metas?.canais || {};
    const metaTotal = Number(data?.metas?.meta_total) || 0;

    // 2) lista de canais = configuração (todos, mesmo sem venda) ∪ por_canal
    type Canal = { canal: string; rotulo: string; meta: number; realizado: number; ordem: number };
    const canais = new Map<string, Canal>();
    for (const c of configCanais) {
      const pct = c.pct_channel ? metasCanais[c.pct_channel] : null;
      canais.set(c.canal, {
        canal: c.canal,
        rotulo: c.rotulo || c.canal,
        meta: Number(pct?.meta) || 0,
        realizado: 0,
        ordem: (c.grupo === "mrs" ? 100 : 0) + (Number(c.ordem) || 0),
      });
    }
    for (const c of porCanal) {
      const cur = canais.get(c.canal) || {
        canal: c.canal, rotulo: c.rotulo || c.canal, meta: 0, realizado: 0,
        ordem: (c.grupo === "mrs" ? 100 : 0) + (Number(c.ordem) || 0),
      };
      cur.realizado = Number(c.realizado) || 0;
      if (Number(c.meta) > 0) cur.meta = Number(c.meta);
      canais.set(c.canal, cur);
    }
    const somaCanais = Array.from(canais.values()).reduce((s, c) => s + c.realizado, 0);
    const residuo = r2(totalApi - somaCanais);
    if (Math.abs(residuo) >= 0.5) {
      canais.set(SEM_CANAL.canal, { ...SEM_CANAL, meta: 0, realizado: residuo, ordem: 999 });
    }

    // 3) canal → "vendedor" do Nexus (cria se não existir; casa pelo nome)
    const { data: sellers, error: eSellers } = await supabase
      .from("company_salespeople")
      .select("id, name, is_active, unit_id, team_id, sector_id")
      .eq("company_id", COMPANY_ID);
    if (eSellers) return json({ error: `company_salespeople: ${eSellers.message}` }, 500);
    const byName = new Map((sellers || []).map((s: any) => [norm(s.name), s]));
    const criados: string[] = [];
    const spDoCanal = new Map<string, any>();
    for (const c of canais.values()) {
      let sp = byName.get(norm(c.rotulo));
      if (!sp) {
        if (dryRun) { criados.push(c.rotulo); spDoCanal.set(c.canal, { id: null, name: c.rotulo }); continue; }
        const { data: novo, error } = await supabase
          .from("company_salespeople")
          .insert({ company_id: COMPANY_ID, name: c.rotulo, access_code: genCode(), is_active: true })
          .select("id, name, is_active, unit_id, team_id, sector_id")
          .single();
        if (error) return json({ error: `criar canal ${c.rotulo}: ${error.message}` }, 500);
        sp = novo; byName.set(norm(c.rotulo), sp); criados.push(c.rotulo);
      }
      spDoCanal.set(c.canal, sp);
    }

    // 4) o que o Nexus já tem no mês, por canal (fora do dia de lançamento vs no dia)
    const spIds = Array.from(spDoCanal.values()).map((s) => s.id).filter(Boolean);
    const outrosDias = new Map<string, number>();
    const noDia = new Map<string, number>();
    if (spIds.length) {
      const { data: rows, error } = await supabase
        .from("kpi_entries")
        .select("salesperson_id, entry_date, value")
        .eq("company_id", COMPANY_ID)
        .eq("kpi_id", KPI_FATURAMENTO)
        .in("salesperson_id", spIds)
        .gte("entry_date", iniMes)
        .lte("entry_date", ultimoDia)
        .limit(5000);
      if (error) return json({ error: `kpi_entries: ${error.message}` }, 500);
      for (const r of rows || []) {
        const k = r.salesperson_id as string;
        if (r.entry_date === dia) noDia.set(k, (noDia.get(k) || 0) + Number(r.value || 0));
        else outrosDias.set(k, (outrosDias.get(k) || 0) + Number(r.value || 0));
      }
    }

    // 5) plano de lançamento por delta
    const plano: { canal: string; rotulo: string; api: number; outros: number; hojeAtual: number; valorHoje: number; sp: any }[] = [];
    for (const c of Array.from(canais.values()).sort((a, b) => a.ordem - b.ordem)) {
      const sp = spDoCanal.get(c.canal);
      const outros = sp?.id ? outrosDias.get(sp.id) || 0 : 0;
      const hojeAtual = sp?.id ? noDia.get(sp.id) || 0 : 0;
      const valorHoje = r2(c.realizado - outros);
      if (Math.abs(valorHoje - hojeAtual) > 0.009) {
        plano.push({ canal: c.canal, rotulo: c.rotulo, api: c.realizado, outros, hojeAtual, valorHoje, sp });
      }
    }

    // 6) metas (só mexe se mudou)
    const metasPlano: { alvo: string; de: number | null; para: number }[] = [];
    const { data: kpi } = await supabase.from("company_kpis").select("target_value").eq("id", KPI_FATURAMENTO).single();
    if (ehMesAtual && metaTotal > 0 && Number(kpi?.target_value) !== metaTotal) {
      metasPlano.push({ alvo: "company_kpis.target_value", de: Number(kpi?.target_value) || null, para: metaTotal });
      if (!dryRun) await supabase.from("company_kpis").update({ target_value: metaTotal }).eq("id", KPI_FATURAMENTO);
    }
    const { data: mts } = await supabase
      .from("kpi_monthly_targets")
      .select("id, salesperson_id, target_value")
      .eq("company_id", COMPANY_ID)
      .eq("kpi_id", KPI_FATURAMENTO)
      .eq("month_year", competencia)
      .eq("level_order", LEVEL_META.level_order);
    const mtBySp = new Map<string, any>((mts || []).map((m: any) => [m.salesperson_id || "empresa", m]));
    const alvos: { key: string; salesperson_id: string | null; rotulo: string; meta: number }[] = [];
    if (metaTotal > 0) alvos.push({ key: "empresa", salesperson_id: null, rotulo: "Empresa (meta total)", meta: metaTotal });
    for (const c of canais.values()) {
      const sp = spDoCanal.get(c.canal);
      if (!sp?.id) continue;
      const existente = mtBySp.get(sp.id);
      if (c.meta > 0 || existente) alvos.push({ key: sp.id, salesperson_id: sp.id, rotulo: c.rotulo, meta: c.meta });
    }
    for (const a of alvos) {
      const ex = mtBySp.get(a.key);
      if (ex && Math.abs(Number(ex.target_value) - a.meta) < 0.009) continue;
      metasPlano.push({ alvo: `meta ${competencia} · ${a.rotulo}`, de: ex ? Number(ex.target_value) : null, para: a.meta });
      if (dryRun) continue;
      if (ex) await supabase.from("kpi_monthly_targets").update({ target_value: a.meta }).eq("id", ex.id);
      else await supabase.from("kpi_monthly_targets").insert({
        company_id: COMPANY_ID, kpi_id: KPI_FATURAMENTO, month_year: competencia,
        salesperson_id: a.salesperson_id, target_value: a.meta, ...LEVEL_META,
      });
    }

    const resumo = {
      ok: true, dry_run: dryRun, competencia, dia, total_api: totalApi, soma_canais: r2(somaCanais), residuo,
      meta_total: metaTotal, canais: canais.size, canais_criados: criados,
      lancamentos: plano.map((p) => ({ canal: p.rotulo, api: p.api, ja_lancado_outros_dias: r2(p.outros), no_dia_antes: p.hojeAtual, no_dia_depois: p.valorHoje })),
      metas: metasPlano,
    };
    if (dryRun || plano.length === 0) return json({ ...resumo, gravados: 0 });

    // 7) upsert na linha do dia (UNIQUE vendedor+kpi+dia)
    const lote = plano.map((p) => ({
      company_id: COMPANY_ID,
      kpi_id: KPI_FATURAMENTO,
      salesperson_id: p.sp.id,
      entry_date: dia,
      value: p.valorHoje,
      unit_id: p.sp.unit_id ?? null,
      team_id: p.sp.team_id ?? null,
      sector_id: p.sp.sector_id ?? null,
      observations: `${TAG} sync automático do dashboard 3D Cure HQ · canal ${p.canal}`,
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
