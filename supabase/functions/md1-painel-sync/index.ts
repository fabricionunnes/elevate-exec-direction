// md1-painel-sync: mantém o painel e os KPIs do cliente Vitor Jaci (MD1 Academy)
// em dia com a planilha de controle do cliente, sem depender de máquina local.
//   1. descobre as abas visíveis da planilha (htmlview) e baixa cada uma em CSV;
//   2. se nada mudou desde a última rodada (hash), sai sem gravar nada;
//   3. recalcula os dados do painel e grava o HTML pronto em
//      project_custom_dashboards (aba "Painel de controle" do projeto e link público);
//   4. converge os lançamentos de KPI marcados com [MD1-PLANILHA]: só grava o que
//      mudou e apaga o que sumiu. Lançamento manual não é tocado.
// Meses cujas abas já foram ocultadas na planilha ficam com o que está guardado;
// as vendas são sempre recalculadas para o ano inteiro (aba "Vendas Detalhadas").
// Entrada: { force?: boolean, dry_run?: boolean }. Cron: a cada 2 minutos.
import { createClient } from "@supabase/supabase-js";
import * as L from "./logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SHEET_ID = "1HsR-Mh0FEG-i_5a9L6_8eByELDh-HRMgaocu5LQHc8k";
const COMPANY_ID = "696880e3-054a-45a3-b3ae-268c41b34d5d"; // Vitor Jaci
const PROJECT_ID = "75fc986f-fa82-463f-9e13-ab95d9212e4c";
const TAG = "[MD1-PLANILHA]";
const UA = { "User-Agent": "Mozilla/5.0 (compatible; UNV-Nexus md1-painel-sync)" };
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(t: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const desescapar = (s: string) => s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, "$1");

async function abasVisiveis(): Promise<{ nome: string; gid: string }[]> {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`, { headers: UA });
  if (!r.ok) throw new Error(`planilha inacessível (htmlview ${r.status}). O compartilhamento por link foi fechado?`);
  const h = await r.text(); const out: { nome: string; gid: string }[] = [];
  const re = /\{name: "((?:[^"\\]|\\.)*)", pageUrl: "[^"]*?gid(?:\\x3d|=)(\d+)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(h))) out.push({ nome: desescapar(m[1]), gid: m[2] });
  if (!out.length) throw new Error("não encontrei as abas da planilha (o formato da página mudou ou o acesso foi fechado)");
  return out;
}
async function csv(gid: string): Promise<string> {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`, { headers: UA });
  const t = await r.text();
  if (!r.ok || /^\s*<!DOCTYPE html/i.test(t)) throw new Error(`não consegui baixar a aba ${gid} (${r.status})`);
  return t;
}
const codigo = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    let body: { force?: boolean; dry_run?: boolean } = {};
    try { body = await req.json(); } catch { /* corpo vazio */ }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. planilha
    const abas = (await abasVisiveis()).map((a) => ({ ...a, tipo: L.classificarAba(a.nome) })).filter((a) => a.tipo);
    if (!abas.some((a) => a.tipo!.tipo === "vendas")) throw new Error('a aba "Vendas Detalhadas" não está visível na planilha');
    const textos = await Promise.all(abas.map((a) => csv(a.gid)));
    const hash = await sha256(abas.map((a, i) => a.nome + "\n" + textos[i]).join("\n==\n"));

    const { data: row, error: e0 } = await supabase.from("project_custom_dashboards")
      .select("template, dados, source_hash").eq("project_id", PROJECT_ID).maybeSingle();
    if (e0) throw new Error("leitura do painel: " + e0.message);
    if (!row?.template) throw new Error("painel sem modelo (template) cadastrado");
    if (row.source_hash === hash && !body.force) return json({ ok: true, mudou: false });

    // 2. cálculo
    let vendas: Record<number, any> = {}; const agendas: Record<number, any> = {}; const funis: Record<number, any> = {};
    abas.forEach((a, i) => {
      const rows = L.parseCsv(textos[i]); const t = a.tipo!;
      if (t.tipo === "vendas") vendas = L.lerVendas(rows);
      else if (t.tipo === "agenda") agendas[t.mes] = L.lerAgenda(rows, t.mes);
      else if (t.tipo === "funil") funis[t.mes] = L.lerFunil(rows, t.mes);
    });
    const antigos: Record<number, any> = {};
    for (const m of (row.dados?.meses || [])) antigos[m.n] = m;
    const ns = [...new Set([...Object.keys(antigos), ...Object.keys(vendas), ...Object.keys(agendas), ...Object.keys(funis)].map(Number))].sort((a, b) => a - b);
    const meses = ns.map((n) => L.montarMes(n, vendas[n] || null, agendas[n] || null, funis[n] || null, antigos[n] || null));
    const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
    // a foto do Sistema GMC (dados.sistema) é gravada à parte e precisa sobreviver ao recálculo
    const dados = { gerado_em: agora, fonte: "Painel de controle GMC 2026", ano: L.ANO, meses, ...(row.dados?.sistema ? { sistema: row.dados.sistema } : {}) };
    const html = String(row.template).replace("/*DADOS*/", JSON.stringify(dados).replace(/<\//g, "<\\/"));

    // 3. KPIs
    const lan = L.lancamentos(vendas, agendas, funis);
    const { data: kpis } = await supabase.from("company_kpis").select("id, name").eq("company_id", COMPANY_ID);
    const kpiId: Record<string, string> = {}; for (const k of kpis || []) kpiId[k.name] = k.id;
    const { data: sps } = await supabase.from("company_salespeople").select("id, name").eq("company_id", COMPANY_ID);
    const spId: Record<string, string> = {}; for (const s of sps || []) spId[s.name] = s.id;
    const novos = [...new Set(lan.map((l: any[]) => l[0]))].filter((p) => !spId[p as string]) as string[];
    const desejado = new Map<string, { salesperson_id: string; kpi_id: string; entry_date: string; value: number }>();
    const existentes: { id: string; salesperson_id: string; kpi_id: string; entry_date: string; value: number }[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase.from("kpi_entries").select("id, salesperson_id, kpi_id, entry_date, value")
        .eq("company_id", COMPANY_ID).like("observations", TAG + "%").order("id").range(de, de + 999);
      if (error) throw new Error("leitura dos lançamentos: " + error.message);
      existentes.push(...(data || [])); if (!data || data.length < 1000) break;
    }
    if (body.dry_run) return json({ ok: true, dry_run: true, abas: abas.map((a) => a.nome), meses: meses.map((m) => [m.mes, m.vendas, m.faturamento, m.agendadas, m.realizadas, m.leads]), lancamentos: lan.length, existentes: existentes.length, pessoas_novas: novos });

    if (novos.length) {
      const { data: ins, error } = await supabase.from("company_salespeople").insert(novos.map((name) => ({
        company_id: COMPANY_ID, name, access_code: codigo(), is_active: true, exclude_from_ranking: [L.MKT, L.SEM_V, L.SEM_S].includes(name),
      }))).select("id, name");
      if (error) throw new Error("cadastro de pessoas: " + error.message);
      for (const s of ins || []) spId[s.name] = s.id;
    }
    for (const [p, k, d, v] of lan as [string, string, string, number][]) {
      if (!kpiId[k] || !spId[p]) continue;
      desejado.set(`${spId[p]}|${kpiId[k]}|${d}`, { salesperson_id: spId[p], kpi_id: kpiId[k], entry_date: d, value: v });
    }
    // escopo do que esta rodada pode apagar: vendas o ano todo; agenda e funil só nos meses com aba visível
    const idVenda = new Set(L.KPIS_VENDA.map((k: string) => kpiId[k]).filter(Boolean));
    const idFunil = new Set(["Leads", "MQLs"].map((k) => kpiId[k]).filter(Boolean));
    const mesAg = new Set(Object.keys(agendas).map((n) => `${L.ANO}-${String(n).padStart(2, "0")}`));
    const mesFu = new Set(Object.keys(funis).map((n) => `${L.ANO}-${String(n).padStart(2, "0")}`));
    const noEscopo = (e: { kpi_id: string; entry_date: string }) => idVenda.has(e.kpi_id) ? true : idFunil.has(e.kpi_id) ? mesFu.has(e.entry_date.slice(0, 7)) : mesAg.has(e.entry_date.slice(0, 7));
    const atual = new Map(existentes.map((e) => [`${e.salesperson_id}|${e.kpi_id}|${e.entry_date}`, e]));
    const gravar = [...desejado.entries()].filter(([key, d]) => { const a = atual.get(key); return !a || Math.abs(Number(a.value) - d.value) > 0.004; })
      .map(([, d]) => ({ ...d, company_id: COMPANY_ID, observations: TAG }));
    const apagar = existentes.filter((e) => !desejado.has(`${e.salesperson_id}|${e.kpi_id}|${e.entry_date}`) && noEscopo(e)).map((e) => e.id);
    for (let i = 0; i < gravar.length; i += 300) {
      const { error } = await supabase.from("kpi_entries").upsert(gravar.slice(i, i + 300), { onConflict: "salesperson_id,kpi_id,entry_date" });
      if (error) throw new Error("gravação dos lançamentos: " + error.message);
    }
    for (let i = 0; i < apagar.length; i += 200) {
      const { error } = await supabase.from("kpi_entries").delete().in("id", apagar.slice(i, i + 200));
      if (error) throw new Error("limpeza dos lançamentos: " + error.message);
    }

    // 4. painel
    const { error: e1 } = await supabase.from("project_custom_dashboards")
      .update({ html, dados, source_hash: hash, source: "planilha online, leitura automática", updated_at: new Date().toISOString() }).eq("project_id", PROJECT_ID);
    if (e1) throw new Error("gravação do painel: " + e1.message);
    return json({ ok: true, mudou: true, gravados: gravar.length, apagados: apagar.length, pessoas_novas: novos, abas: abas.map((a) => a.nome) });
  } catch (e) {
    console.error("md1-painel-sync:", e);
    return json({ ok: false, error: String((e as Error)?.message || e).slice(0, 400) }, 500);
  }
});
