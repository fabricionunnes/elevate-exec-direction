import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVISORS = [
  {
    role: 'CFO',
    name: 'Carlos Finance',
    personality: 'Conservador, analítico, focado em números e sustentabilidade financeira',
    focus: 'Análise financeira, caixa, margem, EBITDA, valuation, risco financeiro',
    style: 'Linguagem técnica financeira, sempre apresenta números e cenários pessimistas para balancear'
  },
  {
    role: 'COO',
    name: 'Olivia Operations',
    personality: 'Pragmática, orientada à execução, foco em viabilidade',
    focus: 'Operação, processos, entrega, capacidade do time, gargalos operacionais',
    style: 'Linguagem direta, questiona viabilidade prática e prazos'
  },
  {
    role: 'CRO',
    name: 'Ricardo Revenue',
    personality: 'Agressivo, orientado a crescimento, otimista sobre oportunidades',
    focus: 'Vendas, marketing, crescimento, pipeline, conversão, churn, receita',
    style: 'Linguagem de vendas, foca em upside e oportunidades de crescimento'
  },
  {
    role: 'CPO',
    name: 'Paula Product',
    personality: 'Centrada no cliente, empática, foco em valor entregue',
    focus: 'Entrega de valor, satisfação, CSAT, NPS, experiência do cliente, retenção',
    style: 'Linguagem focada no cliente, sempre traz a perspectiva do usuário'
  },
  {
    role: 'Board Chair',
    name: 'Bruno Board',
    personality: 'Estratégico, visionário, conciliador, foco em longo prazo',
    focus: 'Visão sistêmica, longo prazo, alinhamento estratégico, governança',
    style: 'Linguagem estratégica, sintetiza opiniões e aponta direção final'
  }
];

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

async function fetchBusinessContext(supabase: any) {
  // Fetch companies and financial/business data
  const [
    { data: companies },
    { data: healthScores },
    { data: csatResponses },
    { data: decisions },
    { data: planning },
    { data: goals }
  ] = await Promise.all([
    supabase.from('onboarding_companies').select('id, contract_value, payment_method, status').eq('status', 'active'),
    supabase.from('client_health_scores').select('total_score, risk_level').limit(100),
    supabase.from('csat_responses').select('score').limit(100),
    supabase.from('ceo_decisions').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('ceo_planning').select('*').order('year', { ascending: false }).limit(12),
    supabase.from('ceo_strategic_goals').select('*').limit(20)
  ]);

  // Calculate MRR from active companies
  const activeClients = companies?.length || 0;
  const totalMRR = calculateMRRFromCompanies(companies || []);
  const formattedMRR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalMRR);
  
  const avgHealth = healthScores?.length ? healthScores.reduce((sum: number, h: any) => sum + (h.total_score || 0), 0) / healthScores.length : 0;
  const atRiskClients = healthScores?.filter((h: any) => 
    h.risk_level === 'alto' || h.risk_level === 'crítico' || h.risk_level === 'high' || h.risk_level === 'critical'
  )?.length || 0;
  const avgCSAT = csatResponses?.length ? csatResponses.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / csatResponses.length : 0;

  return {
    metrics: {
      activeClients,
      totalMRR,
      formattedMRR,
      avgHealth: Math.round(avgHealth),
      atRiskClients,
      avgCSAT: avgCSAT.toFixed(1)
    },
    recentDecisions: decisions?.slice(0, 5) || [],
    planning: planning || [],
    goals: goals || []
  };
}

async function getAdvisorOpinion(
  advisor: typeof ADVISORS[0],
  decision: string,
  context: any,
  apiKey: string
) {
  const systemPrompt = `Você é ${advisor.name}, ${advisor.role} de uma empresa de consultoria em vendas B2B.

PERSONALIDADE: ${advisor.personality}
FOCO DE ANÁLISE: ${advisor.focus}
ESTILO DE RESPOSTA: ${advisor.style}

Você faz parte de um Board Virtual que aconselha o CEO antes de decisões importantes.

CONTEXTO DO NEGÓCIO:
- Clientes ativos: ${context.metrics.activeClients}
- MRR Atual: ${context.metrics.formattedMRR}
- Health Score médio: ${context.metrics.avgHealth}/100
- Clientes em risco: ${context.metrics.atRiskClients}
- CSAT médio: ${context.metrics.avgCSAT}

DECISÕES RECENTES:
${context.recentDecisions?.map((d: any) => `- ${d.title} (${d.status})`).join('\n') || 'Nenhuma'}

METAS ESTRATÉGICAS:
${context.goals?.map((g: any) => `- ${g.title}: ${g.current_value || 0}/${g.target_value || 0}`).join('\n') || 'Nenhuma definida'}

Responda SEMPRE em português brasileiro.
Seja direto e objetivo.
Mantenha seu papel e personalidade consistentes.`;

  const userPrompt = `O CEO está considerando a seguinte decisão/dilema:

"${decision}"

Como ${advisor.role}, analise esta decisão e forneça:

1. SUA OPINIÃO (2-3 parágrafos concisos do seu ponto de vista como ${advisor.role})
2. RISCOS (lista de 2-4 riscos principais da sua perspectiva)
3. OPORTUNIDADES (lista de 2-4 oportunidades que você identifica)
4. AJUSTES SUGERIDOS (lista de 1-3 ajustes que melhorariam a decisão)
5. RECOMENDAÇÃO FINAL (uma frase: aprovar, ajustar ou rejeitar, com justificativa breve)

Responda em formato JSON:
{
  "opinion": "sua opinião detalhada",
  "risks": ["risco 1", "risco 2"],
  "opportunities": ["oportunidade 1", "oportunidade 2"],
  "adjustments": ["ajuste 1", "ajuste 2"],
  "recommendation": "sua recomendação final"
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
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Error from AI for ${advisor.role}:`, error);
    throw new Error(`AI error for ${advisor.role}: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Parse JSON from response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error(`Failed to parse JSON for ${advisor.role}:`, e);
  }

  // Fallback
  return {
    opinion: content,
    risks: [],
    opportunities: [],
    adjustments: [],
    recommendation: 'Análise inconclusiva'
  };
}

async function generateBoardSummary(
  decision: string,
  opinions: any[],
  context: any,
  apiKey: string
) {
  const opinionsText = opinions.map(o => 
    `${o.advisor_role} (${o.advisor_name}): ${o.recommendation}`
  ).join('\n');

  const systemPrompt = `Você é o secretário executivo do Board Virtual, responsável por sintetizar as discussões e criar o resumo final para o CEO.`;

  const userPrompt = `DECISÃO ANALISADA:
"${decision}"

PARECERES DOS CONSELHEIROS:
${opinions.map(o => `
**${o.advisor_role} - ${o.advisor_name}:**
Opinião: ${o.opinion}
Riscos: ${o.risks?.join(', ') || 'Nenhum'}
Oportunidades: ${o.opportunities?.join(', ') || 'Nenhuma'}
Recomendação: ${o.recommendation}
`).join('\n')}

Com base nos pareceres acima, crie:

1. PONTOS DE CONSENSO: onde os conselheiros concordam
2. PONTOS DE DIVERGÊNCIA: onde há opiniões conflitantes
3. RISCOS CRÍTICOS: os riscos mais importantes destacados
4. OPORTUNIDADES IGNORADAS: oportunidades que podem não estar sendo consideradas
5. RESUMO DO BOARD: síntese executiva da discussão (2-3 parágrafos)
6. RECOMENDAÇÃO FINAL: a recomendação consolidada do conselho

Responda em JSON:
{
  "consensus": ["ponto 1", "ponto 2"],
  "divergence": ["ponto 1", "ponto 2"],
  "criticalRisks": ["risco 1", "risco 2"],
  "opportunities": ["oportunidade 1", "oportunidade 2"],
  "summary": "resumo executivo",
  "recommendation": "recomendação final consolidada"
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
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
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
    console.error('Failed to parse summary JSON:', e);
  }

  return {
    consensus: [],
    divergence: [],
    criticalRisks: [],
    opportunities: [],
    summary: content,
    recommendation: 'Análise inconclusiva'
  };
}

Deno.serve(async (req) => {
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

    const { sessionId, decision } = await req.json();

    if (!sessionId || !decision) {
      return new Response(JSON.stringify({ error: 'sessionId and decision are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing board session ${sessionId} for decision: ${decision.substring(0, 50)}...`);

    // Update session status to analyzing
    await supabase
      .from('ceo_board_sessions')
      .update({ status: 'analyzing' })
      .eq('id', sessionId);

    // Fetch business context
    const context = await fetchBusinessContext(supabase);
    console.log('Business context fetched:', context.metrics);

    // Get opinions from all advisors in parallel
    const opinionPromises = ADVISORS.map(async (advisor) => {
      try {
        const opinion = await getAdvisorOpinion(advisor, decision, context, lovableApiKey);
        return {
          session_id: sessionId,
          advisor_role: advisor.role,
          advisor_name: advisor.name,
          opinion: opinion.opinion,
          risks: opinion.risks || [],
          opportunities: opinion.opportunities || [],
          suggested_adjustments: opinion.adjustments || [],
          recommendation: opinion.recommendation
        };
      } catch (error: any) {
        console.error(`Error getting opinion from ${advisor.role}:`, error);
        return {
          session_id: sessionId,
          advisor_role: advisor.role,
          advisor_name: advisor.name,
          opinion: `Erro ao obter parecer: ${error?.message || 'Erro desconhecido'}`,
          risks: [],
          opportunities: [],
          suggested_adjustments: [],
          recommendation: 'Erro na análise'
        };
      }
    });

    const opinions = await Promise.all(opinionPromises);
    console.log(`Got ${opinions.length} advisor opinions`);

    // Save opinions to database
    const { error: opinionsError } = await supabase
      .from('ceo_board_opinions')
      .insert(opinions);

    if (opinionsError) {
      console.error('Error saving opinions:', opinionsError);
    }

    // Generate board summary
    const summary = await generateBoardSummary(decision, opinions, context, lovableApiKey);
    console.log('Board summary generated');

    // Update session with summary
    const { error: updateError } = await supabase
      .from('ceo_board_sessions')
      .update({
        context_data: context,
        consensus_points: summary.consensus || [],
        divergence_points: summary.divergence || [],
        critical_risks: summary.criticalRisks || [],
        opportunities: summary.opportunities || [],
        board_summary: summary.summary,
        final_recommendation: summary.recommendation,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      opinions,
      summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in ceo-virtual-board:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
