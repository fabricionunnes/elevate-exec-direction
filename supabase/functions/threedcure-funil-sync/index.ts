// threedcure-funil-sync: traz do sistema da 3D Cure (3D Cure HQ, api-dashboard) os recursos
// `funil`, `clientes` e `investimento` e grava nas tabelas kpi_funil_*, kpi_clientes_* e
// kpi_investimento_mensal, que alimentam o Painel de KPIs do cliente (CAC, funil, LTV).
// Separada da threedcure-sync de propósito: aquela grava os KPIs de faturamento e não pode parar.
// Recurso que a API ainda não devolve (ou devolve 403) é só pulado e aparece em `recursos`.
// Entrada: { competencia?: "YYYY-MM", mes_anterior?: boolean, dry_run?: boolean }
// Autenticação: header x-sync-secret = THREEDCURE_FUNIL_SECRET, ou Bearer da service role.
// Responde sempre com `ok`; erro vem com ok:false e HTTP 500 (o cron enxerga a falha).
import { createClient } from "npm:@supabase/supabase-js@2";

const COMPANY_ID = "6e94acf4-4888-4c1c-bacd-0861ced43a87"; // 3D CURE
const API = "https://gkokqywekmqfwprkicor.supabase.co/functions/v1/api-dashboard";
const RECURSOS = ["funil", "clientes", "investimento"] as const;

type J = Record<string, any>;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const num = (v: unknown): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const mesIso = (v: string) => (/^\d{4}-\d{2}$/.test(v) ? `${v}-01` : /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(0, 7)}-01` : null);
const norm = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 1);

/** casa o nome do sistema da cliente com o cadastro: todos os tokens do nome curto dentro do nome longo */
function casador(pessoas: { id: string; name: string }[]) {
  const cad = pessoas.map((p) => ({ id: p.id, t: norm(p.name) }));
  return (nome: string): string | null => {
    const t = norm(nome);
    if (!t.length) return null;
    const hits = cad.filter((c) => t.every((x) => c.t.includes(x)) || c.t.every((x) => t.includes(x)));
    if (hits.length === 1) return hits[0].id;
    const pu = cad.filter((c) => c.t[0] === t[0] && c.t[c.t.length - 1] === t[t.length - 1]);
    return pu.length === 1 ? pu[0].id : null;
  };
}

/** paginado em 500 linhas por insert */
async function inserir(sb: any, tabela: string, linhas: J[], conflito: string) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await sb.from(tabela).upsert(linhas.slice(i, i + 500), { onConflict: conflito });
    if (error) throw new Error(`${tabela}: ${error.message}`);
  }
}

async function lerApi(ano: number, mes: number) {
  const token = Deno.env.get("THREEDCURE_API_TOKEN");
  if (!token) throw new Error("THREEDCURE_API_TOKEN ausente");
  const r = await fetch(`${API}?ano=${ano}&mes=${mes}&recursos=${RECURSOS.join(",")}`, { headers: { Authorization: `Bearer ${token}` } });
  const txt = await r.text();
  let corpo: J | null = null;
  try { corpo = JSON.parse(txt); } catch { /* corpo não é JSON */ }
  // recurso fora do escopo da chave: a API responde 403; tenta um por um pra pegar o que existir
  if (r.status === 403) {
    const parcial: J = {}; const status: J = {};
    for (const rec of RECURSOS) {
      const x = await fetch(`${API}?ano=${ano}&mes=${mes}&recursos=${rec}`, { headers: { Authorization: `Bearer ${token}` } });
      status[rec] = x.status;
      if (x.ok) Object.assign(parcial, await x.json());
    }
    return { status: 403, corpo: parcial, porRecurso: status };
  }
  if (!r.ok) throw new Error(`api-dashboard ${r.status}: ${txt.slice(0, 200)}`);
  return { status: r.status, corpo: corpo ?? {}, porRecurso: null };
}

Deno.serve(async (req) => {
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const segredo = Deno.env.get("THREEDCURE_FUNIL_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  if (!((segredo && req.headers.get("x-sync-secret") === segredo) || auth === `Bearer ${service}`)) return json({ ok: false, error: "não autorizado" }, 401);

  try {
    const body: J = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    let ano = agora.getFullYear(), mes = agora.getMonth() + 1;
    if (body.competencia && /^\d{4}-\d{2}$/.test(body.competencia)) { ano = Number(body.competencia.slice(0, 4)); mes = Number(body.competencia.slice(5, 7)); }
    else if (body.mes_anterior) { mes -= 1; if (mes === 0) { mes = 12; ano -= 1; } }
    const competencia = `${ano}-${String(mes).padStart(2, "0")}`;
    const dry = !!body.dry_run;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, service, { auth: { persistSession: false } });
    const { corpo, porRecurso } = await lerApi(ano, mes);
    const { data: pessoas } = await sb.from("company_salespeople").select("id,name").eq("company_id", COMPANY_ID);
    const casa = casador(pessoas ?? []);
    const agoraIso = new Date().toISOString();
    const resumo: J = { ok: true, competencia, dry_run: dry, chaves_na_api: Object.keys(corpo), recursos: {} as J, por_recurso_http: porRecurso };

    /* ---------- funil ---------- */
    const f = corpo.funil;
    if (f && Array.isArray(f.etapas) && Array.isArray(f.por_dia)) {
      const etapas = f.etapas.filter((e: J) => e?.chave).map((e: J, i: number) => ({ company_id: COMPANY_ID, chave: String(e.chave), rotulo: String(e.rotulo ?? e.chave), ordem: num(e.ordem) ?? i + 1, updated_at: agoraIso }));
      const acum = new Map<string, J>();
      const semCasar = new Set<string>();
      for (const l of f.por_dia) {
        const data = String(l?.data ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data.slice(0, 7) !== competencia || !l?.etapa) continue;
        const vendedora = String(l.vendedora ?? "").trim();
        const k = `${data}|${vendedora}|${l.etapa}`;
        const sp = vendedora ? casa(vendedora) : null;
        if (vendedora && !sp) semCasar.add(vendedora);
        const x = acum.get(k) ?? { company_id: COMPANY_ID, data, vendedora, salesperson_id: sp, canal: l.canal ?? null, etapa: String(l.etapa), quantidade: 0, updated_at: agoraIso };
        x.quantidade += num(l.quantidade) ?? 0;
        acum.set(k, x);
      }
      const perdas = (Array.isArray(f.perdas) ? f.perdas : []).filter((p: J) => p?.motivo).map((p: J) => ({ company_id: COMPANY_ID, mes: `${competencia}-01`, motivo: String(p.motivo), quantidade: num(p.quantidade) ?? 0, updated_at: agoraIso }));
      resumo.recursos.funil = { etapas: etapas.length, linhas: acum.size, perdas: perdas.length, vendedoras_sem_cadastro: [...semCasar] };
      if (!dry) {
        if (etapas.length) {
          await inserir(sb, "kpi_funil_etapas", etapas, "company_id,chave");
          // etapa que saiu do processo deles sai do funil
          await sb.from("kpi_funil_etapas").delete().eq("company_id", COMPANY_ID).not("chave", "in", `(${etapas.map((e: J) => `"${e.chave.replace(/"/g, "")}"`).join(",")})`);
        }
        await inserir(sb, "kpi_funil_diario", [...acum.values()], "company_id,data,vendedora,etapa");
        // linha do mês que não veio mais na API (corrigida ou apagada lá) é apagada aqui
        const { data: atuais } = await sb.from("kpi_funil_diario").select("data,vendedora,etapa").eq("company_id", COMPANY_ID).gte("data", `${competencia}-01`).lte("data", `${competencia}-31`);
        for (const a of atuais ?? []) if (!acum.has(`${a.data}|${a.vendedora}|${a.etapa}`))
          await sb.from("kpi_funil_diario").delete().eq("company_id", COMPANY_ID).eq("data", a.data).eq("vendedora", a.vendedora).eq("etapa", a.etapa);
        await sb.from("kpi_funil_perdas").delete().eq("company_id", COMPANY_ID).eq("mes", `${competencia}-01`);
        if (perdas.length) await inserir(sb, "kpi_funil_perdas", perdas, "company_id,mes,motivo");
      }
    } else resumo.recursos.funil = "ausente na API";

    /* ---------- clientes ---------- */
    const c = corpo.clientes;
    if (c && (Array.isArray(c.por_mes) || c.ltv)) {
      const mensal = (Array.isArray(c.por_mes) ? c.por_mes : []).map((m: J) => ({ m, mes: mesIso(String(m?.mes ?? "")) })).filter((x: J) => x.mes).map(({ m, mes }: J) => ({
        company_id: COMPANY_ID, mes, novos: num(m.novos), recorrentes: num(m.recorrentes),
        ativos: num(m.ativos) ?? ((num(m.novos) ?? 0) + (num(m.recorrentes) ?? 0)),
        faturamento_novos: num(m.faturamento_novos), faturamento_recorrentes: num(m.faturamento_recorrentes), updated_at: agoraIso,
      }));
      const ltv = c.ltv ? { company_id: COMPANY_ID, valor: num(c.ltv.valor), meses: num(c.ltv.meses), compras_por_cliente: num(c.ltv.compras_por_cliente), taxa_recompra: num(c.ltv.taxa_recompra), base_clientes: num(c.ltv.base_clientes), desde: mesIso(String(c.ltv.desde ?? "")) ? String(c.ltv.desde).slice(0, 10) : null, updated_at: agoraIso } : null;
      const porVend = (Array.isArray(c.por_vendedora) ? c.por_vendedora : []).filter((v: J) => v?.vendedora).map((v: J) => ({ company_id: COMPANY_ID, mes: `${competencia}-01`, vendedora: String(v.vendedora).trim(), salesperson_id: casa(String(v.vendedora)), novos: num(v.novos), recorrentes: num(v.recorrentes), updated_at: agoraIso }));
      resumo.recursos.clientes = { meses: mensal.length, ltv: !!ltv, por_vendedora: porVend.length };
      if (!dry) {
        if (mensal.length) await inserir(sb, "kpi_clientes_mensal", mensal, "company_id,mes");
        if (ltv) await inserir(sb, "kpi_clientes_ltv", [ltv], "company_id");
        await sb.from("kpi_clientes_vendedora").delete().eq("company_id", COMPANY_ID).eq("mes", `${competencia}-01`);
        if (porVend.length) await inserir(sb, "kpi_clientes_vendedora", porVend, "company_id,mes,vendedora");
      }
    } else resumo.recursos.clientes = "ausente na API";

    /* ---------- investimento ---------- */
    const inv = corpo.investimento;
    if (inv && Array.isArray(inv.por_mes)) {
      const linhas = inv.por_mes.map((m: J) => ({ m, mes: mesIso(String(m?.mes ?? "")) })).filter((x: J) => x.mes).map(({ m, mes }: J) => ({
        company_id: COMPANY_ID, mes, midia: num(m.midia), time_comercial: num(m.time_comercial), outros: num(m.outros), fonte: "3dcure-hq", updated_at: agoraIso,
      }));
      resumo.recursos.investimento = { meses: linhas.length };
      if (!dry && linhas.length) await inserir(sb, "kpi_investimento_mensal", linhas, "company_id,mes");
    } else resumo.recursos.investimento = "ausente na API";

    return json(resumo);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
