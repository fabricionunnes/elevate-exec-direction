// windash-sync: preenche os KPIs da Kapitao America com os dados do WinDash
// (painel do ERP Winthor do cliente). A API devolve o ACUMULADO do mês por
// vendedor; aqui a gente converge por DELTA: lança hoje a diferença entre o
// acumulado da API e o que o Nexus já tem no mês. Também cadastra vendedor
// novo automaticamente e importa a meta mensal de vendas de cada um.
// Entrada: { competencia?: "YYYY-MM", dry_run?: boolean }
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_ID = "7bae5004-0493-4186-974d-aa2710a7cf78"; // Kapitao America
const TAG = "[WINDASH]";

// KPI do Nexus ← campo da API (por vendedor)
const KPI_MAP: { kpiId: string; pick: (i: any) => number }[] = [
  { kpiId: "eecd4bbe-4da0-4a87-963b-520761393949", pick: (i) => Number(i?.vendas?.valor_bruto) || 0 },            // Faturamento bruto
  { kpiId: "93f7fb52-d155-4753-99bc-8ab3a89f4fd1", pick: (i) => Number(i?.vendas?.quantidade_pedidos) || 0 },    // Vendas
  { kpiId: "fc71c017-c003-4041-b391-73398ff2ae36", pick: (i) => Number(i?.clientes?.com_venda_no_periodo?.total) || 0 }, // Atendimentos
  { kpiId: "e413470a-fe7f-463d-9dd1-fa85f72e7146", pick: (i) => Number(i?.devolucoes?.valor) || 0 },             // Devolução
  { kpiId: "5c668dcb-3314-42c2-8c70-5033dadf8469", pick: (i) => Number(i?.orcamentos?.valor) || 0 },             // Orçamentos no mês
  { kpiId: "14ce2cce-e181-4ad8-a81a-7bb4c42e4d51", pick: (i) => Number(i?.pedidos_nao_faturados?.valor) || 0 },  // Pedidos não faturados
];
const KPI_FATURAMENTO = "eecd4bbe-4da0-4a87-963b-520761393949";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = Deno.env.get("WINDASH_TOKEN");
    if (!token) return json({ error: "WINDASH_TOKEN não configurado" }, 500);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dry_run;
    const comp: string | null = body.competencia || null;

    const url = comp
      ? `https://windash.com.br/api/v1/indicadores?competencia=${comp}`
      : "https://windash.com.br/api/v1/indicadores";
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(45000) });
    if (!resp.ok) return json({ error: `WinDash ${resp.status}: ${(await resp.text()).slice(0, 200)}` }, 502);
    const data = await resp.json();

    const competencia: string = data.competencia; // YYYY-MM
    const vendedoresApi: any[] = data?.loja?.vendedores || [];
    if (!competencia || vendedoresApi.length === 0) return json({ error: "payload sem competencia/vendedores" }, 502);

    const monthStart = `${competencia}-01`;
    const [yy, mm] = competencia.split("-").map(Number);
    const monthEnd = `${competencia}-${String(new Date(yy, mm, 0).getDate()).padStart(2, "0")}`;
    // data do lançamento do delta: hoje (BRT) se for o mês corrente; senão o fim do mês
    const hojeBR = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const entryDate = hojeBR >= monthStart && hojeBR <= monthEnd ? hojeBR : monthEnd;

    // 1) vendedores: casa por nome; cria quem não existe
    const { data: sellers } = await supabase
      .from("company_salespeople")
      .select("id, name, unit_id, team_id, sector_id")
      .eq("company_id", COMPANY_ID);
    const byName = new Map((sellers || []).map((s: any) => [norm(s.name), s]));
    let created = 0;
    for (const v of vendedoresApi) {
      if (!byName.has(norm(v.nome))) {
        const { data: ins, error } = await supabase
          .from("company_salespeople")
          .insert({ company_id: COMPANY_ID, name: v.nome, access_code: genCode(), is_active: true })
          .select("id, name, unit_id, team_id, sector_id")
          .single();
        if (!error && ins) { byName.set(norm(ins.name), ins); created++; }
        else if (error) console.error("[windash-sync] criar vendedor:", error.message);
      }
    }

    // 2) somas atuais do mês no Nexus (por kpi+vendedor), separando a linha
    //    de HOJE (que a gente reescreve) dos outros dias (que ficam como estão).
    //    kpi_entries tem UNIQUE (vendedor, kpi, dia): inserir "mais um delta"
    //    no mesmo dia colide — foi isso que travava o sync depois da 1ª hora.
    const kpiIds = KPI_MAP.map((k) => k.kpiId);
    const outrosDias = new Map<string, number>();
    const hoje = new Map<string, number>();
    for (let from = 0; ; from += 1000) {
      const { data: rows } = await supabase
        .from("kpi_entries")
        .select("kpi_id, salesperson_id, value, entry_date")
        .eq("company_id", COMPANY_ID)
        .in("kpi_id", kpiIds)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd)
        .order("id", { ascending: true })
        .range(from, from + 999);
      (rows || []).forEach((r: any) => {
        const k = `${r.kpi_id}|${r.salesperson_id || ""}`;
        if (r.entry_date === entryDate) hoje.set(k, (hoje.get(k) || 0) + Number(r.value || 0));
        else outrosDias.set(k, (outrosDias.get(k) || 0) + Number(r.value || 0));
      });
      if (!rows || rows.length < 1000) break;
    }

    // 3) deltas + metas
    // valor da linha de HOJE = acumulado da API − soma dos outros dias. Idempotente:
    // pode rodar de hora em hora que converge sem duplicar.
    const plan: { sp: any; kpiId: string; api: number; atual: number; delta: number; valorHoje: number }[] = [];
    const metas: { sp: any; valor: number }[] = [];
    for (const v of vendedoresApi) {
      const sp = byName.get(norm(v.nome));
      if (!sp) continue;
      const ind = v.indicadores || {};
      for (const m of KPI_MAP) {
        const api = m.pick(ind);
        const k = `${m.kpiId}|${sp.id}`;
        const outros = outrosDias.get(k) || 0;
        const hojeAtual = hoje.get(k) || 0;
        const atual = outros + hojeAtual;
        const valorHoje = Math.round((api - outros) * 100) / 100;
        const delta = api - atual;
        if (Math.abs(valorHoje - hojeAtual) > 0.009) plan.push({ sp, kpiId: m.kpiId, api, atual, delta, valorHoje });
      }
      const metaVal = Number(ind?.meta_vendas?.valor) || 0;
      if (metaVal > 0) metas.push({ sp, valor: metaVal });
    }

    if (dryRun) {
      return json({
        ok: true, dry_run: true, competencia, vendedores_api: vendedoresApi.length,
        vendedores_criados: created, lancamentos_planejados: plan.length,
        metas_planejadas: metas.length,
        amostra: plan.slice(0, 12).map((p) => ({ vendedor: p.sp.name, kpi: p.kpiId.slice(0, 8), api: p.api, nexus: p.atual, delta: Math.round(p.delta * 100) / 100 })),
      });
    }

    // 4) grava deltas — em LOTE. Antes era um insert por linha (80+ idas ao
    // banco): o cron (pg_net, 5s de timeout) derrubava a chamada no meio e
    // só 1-3 deltas entravam por hora — o Nexus ficava dias atrás do WinDash.
    let written = 0;
    const linhas = plan.map((p) => ({
      company_id: COMPANY_ID,
      kpi_id: p.kpiId,
      salesperson_id: p.sp.id,
      entry_date: entryDate,
      value: p.valorHoje,
      unit_id: p.sp.unit_id ?? null,
      team_id: p.sp.team_id ?? null,
      sector_id: p.sp.sector_id ?? null,
      observations: `${TAG} sync automático do WinDash (acumulado ${p.api})`,
    }));
    for (let i = 0; i < linhas.length; i += 100) {
      const lote = linhas.slice(i, i + 100);
      // upsert na linha do dia (UNIQUE vendedor+kpi+dia): reescreve, não duplica
      const { error } = await supabase.from("kpi_entries")
        .upsert(lote, { onConflict: "salesperson_id,kpi_id,entry_date" });
      if (error) console.error("[windash-sync] upsert lote:", error.message);
      else written += lote.length;
    }

    // 5) metas mensais de Faturamento por vendedor
    let metasGravadas = 0;
    for (const m of metas) {
      const { data: existing } = await supabase
        .from("kpi_monthly_targets")
        .select("id, target_value")
        .eq("company_id", COMPANY_ID)
        .eq("kpi_id", KPI_FATURAMENTO)
        .eq("salesperson_id", m.sp.id)
        .eq("month_year", competencia)
        .eq("level_name", "Meta")
        .maybeSingle();
      if (existing?.id) {
        if (Number(existing.target_value) !== m.valor) {
          await supabase.from("kpi_monthly_targets").update({ target_value: m.valor }).eq("id", existing.id);
          metasGravadas++;
        }
      } else {
        const { error } = await supabase.from("kpi_monthly_targets").insert({
          company_id: COMPANY_ID, kpi_id: KPI_FATURAMENTO, salesperson_id: m.sp.id,
          month_year: competencia, level_name: "Meta", level_order: 1, target_value: m.valor,
        });
        if (!error) metasGravadas++;
      }
    }

    return json({ ok: true, competencia, entry_date: entryDate, vendedores_criados: created, lancamentos: written, metas_atualizadas: metasGravadas });
  } catch (err) {
    console.error("[windash-sync] erro:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
