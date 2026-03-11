import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, projectId } = await req.json();
    console.log("Commercial Director analysis for company:", companyId, "project:", projectId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all necessary data in parallel
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split("T")[0];
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const [companyRes, kpisRes, salespeopleRes, entriesRes, goalsRes, projectRes] = await Promise.all([
      supabase.from("onboarding_companies").select("*").eq("id", companyId).single(),
      supabase.from("company_kpis").select("*").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
      supabase.from("company_salespeople").select("*").eq("company_id", companyId).eq("is_active", true),
      supabase.from("kpi_entries").select("*").eq("company_id", companyId).gte("entry_date", sixMonthsAgo).order("entry_date", { ascending: false }),
      supabase.from("onboarding_monthly_goals").select("*").eq("project_id", projectId).order("year", { ascending: false }).order("month", { ascending: false }).limit(12),
      supabase.from("onboarding_projects").select("*").eq("id", projectId).single(),
    ]);

    const company = companyRes.data;
    const kpis = kpisRes.data || [];
    const salespeople = salespeopleRes.data || [];
    const entries = entriesRes.data || [];
    const goals = goalsRes.data || [];

    const formatCurrency = (v: number | null) => v == null ? "N/A" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

    // Current month entries
    const currentMonthEntries = entries.filter(e => e.entry_date >= currentMonthStart && e.entry_date <= currentMonthEnd);

    // KPI summaries
    const kpiSummaries = kpis.map(kpi => {
      const kpiEntries = currentMonthEntries.filter(e => e.kpi_id === kpi.id);
      const total = kpiEntries.reduce((s, e) => s + (e.value || 0), 0);
      return {
        name: kpi.name,
        type: kpi.kpi_type,
        target: kpi.target_value,
        total,
        percent: kpi.target_value > 0 ? (total / kpi.target_value) * 100 : 0,
      };
    });

    // Monthly evolution (last 6 months)
    const monthlyEvolution = goals.map(g => ({
      month: `${monthNames[g.month - 1]}/${g.year}`,
      target: g.sales_target,
      result: g.sales_result,
      percent: g.sales_target && g.sales_result ? ((g.sales_result / g.sales_target) * 100).toFixed(1) : "N/A",
    }));

    const contextPrompt = `
Você é um Diretor Comercial experiente e estratégico. Analise os dados a seguir e gere um diagnóstico comercial completo.

IMPORTANTE: Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem texto adicional. Use o formato exato abaixo.

## DADOS DA EMPRESA
- Nome: ${company?.name || "N/A"}
- Segmento: ${company?.segment || "N/A"}
- Desafios: ${company?.main_challenges || "N/A"}
- Metas: ${company?.goals_short_term || "N/A"}
- Time de Vendas: ${company?.sales_team_size || "N/A"} pessoas
- Ticket Médio: ${company?.average_ticket || "N/A"}
- Taxa de Conversão: ${company?.conversion_rate || "N/A"}

## KPIs DO MÊS ATUAL
${kpiSummaries.map(k => `- ${k.name}: ${k.type === 'monetary' ? formatCurrency(k.total) : k.total} / Meta: ${k.type === 'monetary' ? formatCurrency(k.target) : k.target} (${k.percent.toFixed(1)}%)`).join("\n")}

## EVOLUÇÃO MENSAL (últimos meses)
${monthlyEvolution.map(m => `- ${m.month}: Meta ${formatCurrency(m.target)} | Resultado ${formatCurrency(m.result)} | ${m.percent}%`).join("\n") || "Sem dados"}

## VENDEDORES ATIVOS: ${salespeople.length}
## TOTAL DE LANÇAMENTOS NO MÊS: ${currentMonthEntries.length}

Gere o JSON com esta estrutura EXATA:
{
  "commercial_score": <número 0-100>,
  "score_classification": "<uma das: operação comercial desestruturada | estrutura comercial inicial | estrutura comercial organizada | máquina de vendas estruturada>",
  "diagnosis": {
    "lead_generation": { "status": "<adequado|abaixo do ideal|crítico>", "detail": "<texto>" },
    "sales_conversion": { "status": "<adequado|abaixo do ideal|crítico>", "detail": "<texto>" },
    "average_ticket": { "status": "<alto|médio|baixo>", "detail": "<texto>" },
    "revenue_growth": { "status": "<acelerado|estável|desacelerando>", "detail": "<texto>" },
    "sales_predictability": { "status": "<alta|média|baixa>", "detail": "<texto>" },
    "commercial_efficiency": { "status": "<alta|moderada|baixa>", "detail": "<texto>" }
  },
  "radar": [
    { "area": "Geração de Leads", "status": "green|yellow|red", "explanation": "<texto>", "analysis": "<texto>", "causes": "<texto>", "recommendation": "<texto>" },
    { "area": "Conversão de Vendas", "status": "green|yellow|red", "explanation": "<texto>", "analysis": "<texto>", "causes": "<texto>", "recommendation": "<texto>" },
    { "area": "Ticket Médio", "status": "green|yellow|red", "explanation": "<texto>", "analysis": "<texto>", "causes": "<texto>", "recommendation": "<texto>" },
    { "area": "Crescimento de Faturamento", "status": "green|yellow|red", "explanation": "<texto>", "analysis": "<texto>", "causes": "<texto>", "recommendation": "<texto>" },
    { "area": "Previsibilidade de Receita", "status": "green|yellow|red", "explanation": "<texto>", "analysis": "<texto>", "causes": "<texto>", "recommendation": "<texto>" },
    { "area": "Retenção de Clientes", "status": "green|yellow|red", "explanation": "<texto>", "analysis": "<texto>", "causes": "<texto>", "recommendation": "<texto>" },
    { "area": "Eficiência Comercial", "status": "green|yellow|red", "explanation": "<texto>", "analysis": "<texto>", "causes": "<texto>", "recommendation": "<texto>" }
  ],
  "insights": [
    { "title": "<título>", "diagnosis": "<diagnóstico>", "probable_cause": "<causa>", "recommendation": "<recomendação>" }
  ],
  "growth_plan": [
    { "action": "<ação>", "impact": "<alto|médio|baixo>", "description": "<descrição>" }
  ],
  "priorities": [
    { "rank": 1, "title": "<título>", "reason": "<razão>" }
  ],
  "forecast": {
    "current_month_forecast": <número>,
    "goal_probability": <número 0-100>,
    "analysis": "<texto>"
  }
}

Gere de 3 a 5 insights, 5 a 7 ações no plano de crescimento, e 4 a 5 prioridades.
Se não houver dados suficientes para algum campo, faça inferências com base nas informações disponíveis.
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um Diretor Comercial sênior. Responda APENAS em JSON válido, sem markdown." },
          { role: "user", content: contextPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    let content = aiResult.choices?.[0]?.message?.content || "";
    
    // Clean markdown wrapping if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let analysisData;
    try {
      analysisData = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    // Save to database
    const { data: saved, error: saveError } = await supabase
      .from("commercial_director_analyses")
      .insert({
        project_id: projectId,
        company_id: companyId,
        commercial_score: analysisData.commercial_score,
        score_classification: analysisData.score_classification,
        diagnosis: analysisData.diagnosis,
        radar: analysisData.radar,
        insights: analysisData.insights,
        growth_plan: analysisData.growth_plan,
        priorities: analysisData.priorities,
        forecast: analysisData.forecast,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Save error:", saveError);
    }

    return new Response(JSON.stringify({ ...analysisData, id: saved?.id, created_at: saved?.created_at }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Commercial Director error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
