import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to calculate MRR from companies
const calculateMRRFromCompanies = (companies: any[]): number => {
  let mrr = 0;
  
  companies?.forEach((c) => {
    const value = Number(c.contract_value) || 0;
    const paymentMethod = c.payment_method?.toLowerCase() || "";
    
    // Monthly payments = value is already monthly
    if (paymentMethod === "monthly" || paymentMethod === "mensal" || paymentMethod === "recorrente") {
      mrr += value;
    }
    // Quarterly = value / 3
    else if (paymentMethod === "quarterly" || paymentMethod === "trimestral") {
      mrr += value / 3;
    }
    // Semiannual = value / 6
    else if (paymentMethod === "semiannual" || paymentMethod === "semestral") {
      mrr += value / 6;
    }
    // Annual or card (typically annual payments) = value / 12
    else if (paymentMethod === "annual" || paymentMethod === "anual" || paymentMethod === "card" || paymentMethod === "cartao" || paymentMethod === "cartão") {
      mrr += value / 12;
    }
    // Boleto or pix could be annual too
    else if (paymentMethod === "boleto" || paymentMethod === "pix") {
      mrr += value / 12;
    }
    // Skip one-time payments (à vista, único)
    else if (paymentMethod.includes("vista") || paymentMethod.includes("unico") || paymentMethod.includes("único")) {
      // Don't add to MRR - one-time payment
    }
    // Unknown payment method with value > 1000 assume annual
    else if (value > 1000) {
      mrr += value / 12;
    }
    // Small values without payment method, assume monthly
    else if (value > 0) {
      mrr += value;
    }
  });
  
  return mrr;
};

async function fetchBusinessData(supabase: any) {
  const [
    { data: companies },
    { data: healthScores },
    { data: salesHistory },
    { data: decisions },
    { data: planning },
    { data: simulations }
  ] = await Promise.all([
    supabase.from('onboarding_companies').select('id, contract_value, payment_method, status').eq('status', 'active'),
    supabase.from('client_health_scores').select('total_score, risk_level').limit(200),
    supabase.from('company_sales_history').select('revenue, month_year, target_revenue').limit(24),
    supabase.from('ceo_decisions').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('ceo_planning').select('*').order('year', { ascending: false }).limit(12),
    supabase.from('ceo_simulations').select('*').eq('status', 'executed').limit(20)
  ]);

  const activeClients = companies?.length || 0;
  const currentMRR = calculateMRRFromCompanies(companies || []);
  
  const avgHealth = healthScores?.length 
    ? healthScores.reduce((sum: number, h: any) => sum + (h.total_score || 0), 0) / healthScores.length 
    : 70;
  const atRiskClients = healthScores?.filter((h: any) => 
    h.risk_level === 'alto' || h.risk_level === 'crítico' || h.risk_level === 'high' || h.risk_level === 'critical'
  )?.length || 0;
  
  // Calculate churn rate from health scores (at risk / total)
  const churnRate = activeClients > 0 ? (atRiskClients / activeClients) * 100 : 0;

  // Calculate avg revenue growth
  const recentSales = salesHistory?.slice(0, 6) || [];
  const avgRevenue = recentSales.length 
    ? recentSales.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0) / recentSales.length 
    : currentMRR;

  // Past decision outcomes for learning
  const successfulDecisions = decisions?.filter((d: any) => d.final_result === 'positivo')?.length || 0;
  const totalDecisions = decisions?.length || 1;
  const decisionSuccessRate = (successfulDecisions / totalDecisions) * 100;

  // Past simulation accuracy
  const executedSims = simulations || [];
  const avgSimError = executedSims.length > 0
    ? executedSims.reduce((sum: number, s: any) => sum + Math.abs(s.prediction_error || 0), 0) / executedSims.length
    : 15; // Default 15% error

  return {
    currentMRR,
    formattedMRR: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(currentMRR),
    activeClients,
    avgHealth,
    atRiskClients,
    churnRate,
    avgRevenue,
    decisionSuccessRate,
    avgSimError,
    recentDecisions: decisions?.slice(0, 10) || [],
    planning: planning || [],
    historicalSales: salesHistory || []
  };
}

async function runSimulation(
  simulation: any,
  businessData: any,
  apiKey: string
) {
  const systemPrompt = `Você é um simulador de decisões estratégicas altamente preciso para uma empresa de consultoria em vendas B2B.

DADOS ATUAIS DO NEGÓCIO:
- MRR Atual: ${businessData.formattedMRR}
- Clientes Ativos: ${businessData.activeClients}
- Health Score Médio: ${businessData.avgHealth?.toFixed(1)}%
- Clientes em Risco: ${businessData.atRiskClients}
- Taxa de Churn: ${businessData.churnRate?.toFixed(1)}%
- Receita Média Mensal: R$ ${businessData.avgRevenue?.toLocaleString('pt-BR')}
- Taxa de Sucesso em Decisões: ${businessData.decisionSuccessRate?.toFixed(1)}%
- Erro Médio de Simulações Passadas: ${businessData.avgSimError?.toFixed(1)}%

DECISÕES RECENTES E RESULTADOS:
${businessData.recentDecisions?.map((d: any) => 
  `- ${d.title}: ${d.final_result || 'pendente'} (impacto: ${d.actual_impact || 'não medido'})`
).join('\n') || 'Nenhuma'}

INSTRUÇÕES:
1. Analise a decisão proposta com base nos dados históricos
2. Considere correlações observadas em decisões similares passadas
3. Ajuste suas previsões pelo erro médio de simulações anteriores
4. Seja conservador nas estimativas - melhor subestimar
5. Identifique riscos específicos baseados no contexto atual

Responda SEMPRE em português brasileiro.`;

  const userPrompt = `SIMULAÇÃO SOLICITADA:

Tipo: ${simulation.decision_type}
Título: ${simulation.title}
Descrição: ${simulation.description}

VARIÁVEIS DA DECISÃO:
${Object.entries(simulation.variables || {}).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'Nenhuma variável definida'}

Com base nos dados históricos e padrões observados, gere 3 cenários detalhados:

1. CENÁRIO CONSERVADOR (probabilidade mais alta, impacto mais baixo)
2. CENÁRIO REALISTA (equilíbrio entre probabilidade e impacto)
3. CENÁRIO AGRESSIVO (melhor caso, probabilidade mais baixa)

Para cada cenário, calcule:
- Impacto na Receita (R$ e %)
- Impacto no Caixa (R$)
- Impacto no EBITDA (R$ estimado)
- Impacto no Churn (pontos percentuais)
- Probabilidade de ocorrência (%)
- Análise qualitativa

Também identifique:
- Alertas de risco (lista de riscos críticos)
- Projeção de timeline (30, 60, 90 dias)

Responda em JSON:
{
  "conservative": {
    "revenue_impact": número em R$,
    "revenue_percent": número %,
    "cash_impact": número em R$,
    "ebitda_impact": número em R$,
    "churn_impact": número em pontos percentuais,
    "probability": número de 0-100,
    "analysis": "texto da análise"
  },
  "realistic": {
    "revenue_impact": número em R$,
    "revenue_percent": número %,
    "cash_impact": número em R$,
    "ebitda_impact": número em R$,
    "churn_impact": número em pontos percentuais,
    "probability": número de 0-100,
    "analysis": "texto da análise"
  },
  "aggressive": {
    "revenue_impact": número em R$,
    "revenue_percent": número %,
    "cash_impact": número em R$,
    "ebitda_impact": número em R$,
    "churn_impact": número em pontos percentuais,
    "probability": número de 0-100,
    "analysis": "texto da análise"
  },
  "risk_alerts": ["alerta 1", "alerta 2"],
  "timeline": {
    "30_days": "projeção para 30 dias",
    "60_days": "projeção para 60 dias",
    "90_days": "projeção para 90 dias"
  }
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('AI error:', error);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse simulation JSON:', e);
  }

  throw new Error('Failed to parse simulation results');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { simulationId } = await req.json();

    if (!simulationId) {
      return new Response(JSON.stringify({ error: 'simulationId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Running simulation ${simulationId}`);

    // Fetch simulation
    const { data: simulation, error: simError } = await supabase
      .from('ceo_simulations')
      .select('*')
      .eq('id', simulationId)
      .single();

    if (simError || !simulation) {
      throw new Error('Simulation not found');
    }

    // Fetch business data
    const businessData = await fetchBusinessData(supabase);
    console.log('Business data fetched:', { mrr: businessData.currentMRR, formattedMRR: businessData.formattedMRR, clients: businessData.activeClients });

    // Run AI simulation
    const results = await runSimulation(simulation, businessData, lovableApiKey);
    console.log('Simulation results generated');

    // Update simulation with results
    const { error: updateError } = await supabase
      .from('ceo_simulations')
      .update({
        base_data: businessData,
        conservative_revenue_impact: results.conservative?.revenue_impact || 0,
        conservative_cash_impact: results.conservative?.cash_impact || 0,
        conservative_ebitda_impact: results.conservative?.ebitda_impact || 0,
        conservative_churn_impact: results.conservative?.churn_impact || 0,
        conservative_probability: results.conservative?.probability || 0,
        conservative_analysis: results.conservative?.analysis || '',
        realistic_revenue_impact: results.realistic?.revenue_impact || 0,
        realistic_cash_impact: results.realistic?.cash_impact || 0,
        realistic_ebitda_impact: results.realistic?.ebitda_impact || 0,
        realistic_churn_impact: results.realistic?.churn_impact || 0,
        realistic_probability: results.realistic?.probability || 0,
        realistic_analysis: results.realistic?.analysis || '',
        aggressive_revenue_impact: results.aggressive?.revenue_impact || 0,
        aggressive_cash_impact: results.aggressive?.cash_impact || 0,
        aggressive_ebitda_impact: results.aggressive?.ebitda_impact || 0,
        aggressive_churn_impact: results.aggressive?.churn_impact || 0,
        aggressive_probability: results.aggressive?.probability || 0,
        aggressive_analysis: results.aggressive?.analysis || '',
        risk_alerts: results.risk_alerts || [],
        timeline_projection: results.timeline || {},
        status: 'simulated',
        simulated_at: new Date().toISOString()
      })
      .eq('id', simulationId);

    if (updateError) {
      console.error('Error updating simulation:', updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ 
      success: true,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in ceo-decision-simulator:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
