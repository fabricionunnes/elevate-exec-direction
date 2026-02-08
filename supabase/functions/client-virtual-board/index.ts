import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Client-focused advisors
const ADVISORS = [
  {
    role: 'Diretor Comercial',
    name: 'Carlos Vendas',
    personality: 'Agressivo, orientado a resultados, focado em crescimento de receita',
    focus: 'Vendas, prospecção, pipeline, conversão, ticket médio, fidelização',
    style: 'Linguagem de vendas, foca em oportunidades de crescimento e expansão'
  },
  {
    role: 'Diretor de Operações',
    name: 'Olivia Processos',
    personality: 'Pragmática, orientada à execução, foco em eficiência',
    focus: 'Processos, entrega, capacidade do time, gargalos, produtividade',
    style: 'Linguagem direta, questiona viabilidade prática e prazos'
  },
  {
    role: 'Diretor Financeiro',
    name: 'Fernando Finanças',
    personality: 'Conservador, analítico, focado em sustentabilidade financeira',
    focus: 'Fluxo de caixa, margem, custos, investimentos, retorno',
    style: 'Linguagem técnica financeira, sempre apresenta cenários e riscos'
  },
  {
    role: 'Diretor de RH',
    name: 'Helena Pessoas',
    personality: 'Empática, focada em pessoas e cultura organizacional',
    focus: 'Equipe, capacitação, clima, engajamento, liderança',
    style: 'Linguagem humanizada, foca no impacto para as pessoas'
  },
  {
    role: 'CEO Virtual',
    name: 'Victor Estratégico',
    personality: 'Visionário, estratégico, conciliador, foco em longo prazo',
    focus: 'Visão sistêmica, longo prazo, alinhamento estratégico, mercado',
    style: 'Linguagem estratégica, sintetiza opiniões e aponta direção final'
  }
];

// Fetch project context
async function fetchProjectContext(supabase: any, projectId: string) {
  const [
    { data: project },
    { data: company },
    { data: healthScore },
    { data: npsResponses },
    { data: csatResponses },
    { data: tasks },
    { data: goals }
  ] = await Promise.all([
    supabase.from('onboarding_projects').select('*, onboarding_companies(*)').eq('id', projectId).single(),
    supabase.from('onboarding_companies').select('*').eq('id', projectId).maybeSingle(),
    supabase.from('client_health_scores').select('*').eq('project_id', projectId).maybeSingle(),
    supabase.from('onboarding_nps_responses').select('score, feedback').eq('project_id', projectId).order('created_at', { ascending: false }).limit(10),
    supabase.from('csat_responses').select('score').eq('project_id', projectId).limit(50),
    supabase.from('onboarding_tasks').select('status').eq('project_id', projectId),
    supabase.from('monthly_goals').select('*').eq('project_id', projectId).order('year', { ascending: false }).order('month', { ascending: false }).limit(6)
  ]);

  const companyData = project?.onboarding_companies || company;
  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((t: any) => t.status === 'completed')?.length || 0;
  const taskCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const avgNps = npsResponses?.length 
    ? Math.round(npsResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / npsResponses.length)
    : null;
  
  const avgCsat = csatResponses?.length
    ? (csatResponses.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / csatResponses.length).toFixed(1)
    : null;

  return {
    companyName: companyData?.name || 'Não informado',
    segment: companyData?.segment || 'Não informado',
    teamSize: companyData?.team_size || 'Não informado',
    contractValue: companyData?.contract_value || 0,
    healthScore: healthScore?.total_score || 0,
    riskLevel: healthScore?.risk_level || 'desconhecido',
    avgNps,
    avgCsat,
    taskCompletion,
    totalTasks,
    completedTasks,
    goals: goals || []
  };
}

async function getAdvisorOpinion(
  advisor: typeof ADVISORS[0],
  decision: string,
  context: any,
  apiKey: string
) {
  const systemPrompt = `Você é ${advisor.name}, ${advisor.role} de uma empresa.

PERSONALIDADE: ${advisor.personality}
FOCO DE ANÁLISE: ${advisor.focus}
ESTILO DE RESPOSTA: ${advisor.style}

Você faz parte de um Board Virtual que aconselha o empresário/gestor antes de decisões importantes.

CONTEXTO DA EMPRESA:
- Empresa: ${context.companyName}
- Segmento: ${context.segment}
- Tamanho da equipe: ${context.teamSize}
- Health Score: ${context.healthScore}/100
- Nível de risco: ${context.riskLevel}
- NPS médio: ${context.avgNps || 'Não coletado'}
- CSAT médio: ${context.avgCsat || 'Não coletado'}
- Progresso de tarefas: ${context.taskCompletion}% (${context.completedTasks}/${context.totalTasks})

Responda SEMPRE em português brasileiro.
Seja direto e objetivo.
Mantenha seu papel e personalidade consistentes.`;

  const userPrompt = `O gestor está considerando a seguinte decisão/dilema:

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
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error(`Failed to parse JSON for ${advisor.role}:`, e);
  }

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
  const systemPrompt = `Você é o secretário executivo do Board Virtual, responsável por sintetizar as discussões e criar o resumo final para o gestor.`;

  const userPrompt = `DECISÃO ANALISADA:
"${decision}"

CONTEXTO DA EMPRESA:
- Empresa: ${context.companyName}
- Health Score: ${context.healthScore}/100
- Progresso: ${context.taskCompletion}%

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
4. OPORTUNIDADES: oportunidades que podem não estar sendo consideradas
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

    const { sessionId, projectId, decision } = await req.json();

    if (!sessionId || !projectId || !decision) {
      return new Response(JSON.stringify({ error: 'sessionId, projectId and decision are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing client board session ${sessionId} for project ${projectId}`);

    // Update session status to analyzing
    await supabase
      .from('client_board_sessions')
      .update({ status: 'analyzing' })
      .eq('id', sessionId);

    // Fetch project context
    const context = await fetchProjectContext(supabase, projectId);
    console.log('Project context fetched:', context.companyName);

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
      .from('client_board_opinions')
      .insert(opinions);

    if (opinionsError) {
      console.error('Error saving opinions:', opinionsError);
    }

    // Generate board summary
    const summary = await generateBoardSummary(decision, opinions, context, lovableApiKey);
    console.log('Board summary generated');

    // Update session with summary
    const { error: updateError } = await supabase
      .from('client_board_sessions')
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
    console.error('Error in client-virtual-board:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
