// client-benchmark: dados do card "Sua Evolução" + "Você vs o Mercado" do portal.
// Evolução = série de 12 meses do próprio cliente (faturamento, vendas, ticket,
// conversão) com a marca de quando a UNV entrou. Benchmark = mediana do segmento
// na carteira da UNV (só aparece com >=4 empresas no segmento; nunca expõe nome).
// Ativo exclusivo anti-churn: esse comparativo só existe porque a UNV tem a base.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_SEGMENT = 4; // mínimo de empresas no segmento pra liberar o benchmark

function classifyKpi(name: string): "faturamento" | "vendas" | "leads" | "outro" {
  const n = (name || "").toLowerCase();
  if (/(faturamento|faturado|receita)/.test(n)) return "faturamento";
  if (/(venda|fechamento)/.test(n)) return "vendas";
  if (/(lead|oportunidade|contato)/.test(n)) return "leads";
  return "outro";
}
function monthKey(dateStr: string): string { return dateStr.slice(0, 7); } // YYYY-MM
function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentileOf(value: number, all: number[]): number {
  if (all.length < 2) return 50;
  const below = all.filter((v) => v < value).length;
  return Math.round((below / (all.length - 1)) * 100);
}

/** Agrega faturamento/vendas/leads por mês (últimos N meses) de uma empresa. */
async function monthlyAgg(supabase: SupabaseClient, companyId: string, sinceMonth: string) {
  const { data: kpis } = await supabase
    .from("company_kpis").select("id, name, kpi_type").eq("company_id", companyId).eq("is_active", true);
  const catById = new Map<string, string>();
  (kpis || []).forEach((k: any) => catById.set(k.id, classifyKpi(k.name)));

  const { data: entries } = await supabase
    .from("kpi_entries").select("kpi_id, entry_date, value")
    .eq("company_id", companyId).gte("entry_date", sinceMonth + "-01");

  // month -> { faturamento, vendas, leads }
  const byMonth = new Map<string, { faturamento: number; vendas: number; leads: number }>();
  for (const e of entries || []) {
    const cat = catById.get(e.kpi_id);
    if (!cat || cat === "outro") continue;
    const mk = monthKey(e.entry_date);
    if (!byMonth.has(mk)) byMonth.set(mk, { faturamento: 0, vendas: 0, leads: 0 });
    const row = byMonth.get(mk)!;
    (row as any)[cat] += Number(e.value || 0);
  }
  return byMonth;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    let companyId: string | null = body.companyId || null;

    // aceita projectId -> resolve company
    if (!companyId && body.projectId) {
      const { data: proj } = await supabase
        .from("onboarding_projects").select("onboarding_company_id").eq("id", body.projectId).maybeSingle();
      companyId = proj?.onboarding_company_id || null;
    }
    if (!companyId) throw new Error("companyId ou projectId é obrigatório");

    const { data: company } = await supabase
      .from("onboarding_companies").select("id, name, segment").eq("id", companyId).maybeSingle();
    if (!company) throw new Error("empresa não encontrada");

    const { data: proj } = await supabase
      .from("onboarding_projects").select("contract_start_date")
      .eq("onboarding_company_id", companyId).order("created_at").limit(1).maybeSingle();

    // ── Evolução: 12 meses ──
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const sinceMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const months: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const myAgg = await monthlyAgg(supabase, companyId, sinceMonth);
    const evolution = months.map((mk) => {
      const r = myAgg.get(mk) || { faturamento: 0, vendas: 0, leads: 0 };
      return {
        month: mk,
        faturamento: r.faturamento,
        vendas: r.vendas,
        ticket: r.vendas > 0 ? Math.round(r.faturamento / r.vendas) : 0,
        conversao: r.leads > 0 ? Math.round((r.vendas / r.leads) * 1000) / 10 : 0,
      };
    });

    // ── Benchmark do segmento (últimos 90 dias) ──
    let benchmark: any = null;
    if (company.segment) {
      const { data: peers } = await supabase
        .from("onboarding_companies").select("id").eq("segment", company.segment).eq("status", "active");
      const peerIds = (peers || []).map((p: any) => p.id);
      if (peerIds.length >= MIN_SEGMENT) {
        const since90 = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        const sinceM = `${since90.getFullYear()}-${String(since90.getMonth() + 1).padStart(2, "0")}`;
        const tickets: number[] = [];
        const convs: number[] = [];
        let myTicket = 0, myConv = 0;
        for (const pid of peerIds) {
          const agg = await monthlyAgg(supabase, pid, sinceM);
          let fat = 0, ven = 0, lead = 0;
          agg.forEach((r) => { fat += r.faturamento; ven += r.vendas; lead += r.leads; });
          const ticket = ven > 0 ? Math.round(fat / ven) : 0;
          const conv = lead > 0 ? Math.round((ven / lead) * 1000) / 10 : 0;
          if (ticket > 0) { tickets.push(ticket); if (pid === companyId) myTicket = ticket; }
          if (conv > 0) { convs.push(conv); if (pid === companyId) myConv = conv; }
        }
        benchmark = {
          segment: company.segment,
          sample: peerIds.length,
          ticket: tickets.length >= MIN_SEGMENT ? {
            you: myTicket, median: Math.round(median(tickets)), percentile: myTicket > 0 ? percentileOf(myTicket, tickets) : null,
          } : null,
          conversao: convs.length >= MIN_SEGMENT ? {
            you: myConv, median: Math.round(median(convs) * 10) / 10, percentile: myConv > 0 ? percentileOf(myConv, convs) : null,
          } : null,
        };
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      company: { id: company.id, name: company.name, segment: company.segment },
      contract_start: proj?.contract_start_date || null,
      evolution,
      benchmark,
      benchmark_reason: benchmark ? null : "Base insuficiente no segmento para comparar (mínimo 4 empresas).",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
