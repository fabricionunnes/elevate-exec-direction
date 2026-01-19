import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVISORS: Record<string, {
  name: string;
  personality: string;
  focus: string;
  style: string;
}> = {
  'CFO': {
    name: 'Carlos Finance',
    personality: 'Conservador, analítico, focado em números e sustentabilidade financeira',
    focus: 'Análise financeira, caixa, margem, EBITDA, valuation, risco financeiro',
    style: 'Linguagem técnica financeira, sempre apresenta números e cenários'
  },
  'COO': {
    name: 'Olivia Operations',
    personality: 'Pragmática, orientada à execução, foco em viabilidade',
    focus: 'Operação, processos, entrega, capacidade do time, gargalos operacionais',
    style: 'Linguagem direta, questiona viabilidade prática e prazos'
  },
  'CRO': {
    name: 'Ricardo Revenue',
    personality: 'Agressivo, orientado a crescimento, otimista sobre oportunidades',
    focus: 'Vendas, marketing, crescimento, pipeline, conversão, churn, receita',
    style: 'Linguagem de vendas, foca em upside e oportunidades de crescimento'
  },
  'CPO': {
    name: 'Paula Product',
    personality: 'Centrada no cliente, empática, foco em valor entregue',
    focus: 'Entrega de valor, satisfação, CSAT, NPS, experiência do cliente, retenção',
    style: 'Linguagem focada no cliente, sempre traz a perspectiva do usuário'
  },
  'Board Chair': {
    name: 'Bruno Board',
    personality: 'Estratégico, visionário, conciliador, foco em longo prazo',
    focus: 'Visão sistêmica, longo prazo, alinhamento estratégico, governança',
    style: 'Linguagem estratégica, sintetiza opiniões e aponta direção'
  }
};

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

    const { sessionId, message, targetAdvisor } = await req.json();

    if (!sessionId || !message) {
      return new Response(JSON.stringify({ error: 'sessionId and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Board chat for session ${sessionId}, target: ${targetAdvisor || 'all'}`);

    // Fetch session info
    const { data: session, error: sessionError } = await supabase
      .from('ceo_board_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch previous opinions
    const { data: opinions } = await supabase
      .from('ceo_board_opinions')
      .select('*')
      .eq('session_id', sessionId);

    // Fetch chat history
    const { data: chatHistory } = await supabase
      .from('ceo_board_chat')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20);

    // Save user message
    await supabase.from('ceo_board_chat').insert({
      session_id: sessionId,
      role: 'user',
      message: message
    });

    // Determine which advisor(s) should respond
    let advisorsToRespond: string[] = [];
    
    if (targetAdvisor && ADVISORS[targetAdvisor]) {
      advisorsToRespond = [targetAdvisor];
    } else {
      // Let AI determine the best advisor(s) to respond
      advisorsToRespond = await determineRespondingAdvisors(message, lovableApiKey);
    }

    console.log(`Advisors responding: ${advisorsToRespond.join(', ')}`);

    // Get responses from selected advisors
    const responses: Array<{ advisorRole: string; advisorName: string; response: string }> = [];

    for (const advisorRole of advisorsToRespond) {
      const advisor = ADVISORS[advisorRole];
      if (!advisor) continue;

      const response = await getAdvisorChatResponse(
        advisorRole,
        advisor,
        session,
        opinions?.find(o => o.advisor_role === advisorRole),
        chatHistory || [],
        message,
        lovableApiKey
      );

      responses.push({
        advisorRole,
        advisorName: advisor.name,
        response
      });

      // Save advisor response
      await supabase.from('ceo_board_chat').insert({
        session_id: sessionId,
        role: 'advisor',
        advisor_role: advisorRole,
        advisor_name: advisor.name,
        message: response
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      responses
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in ceo-board-chat:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function determineRespondingAdvisors(message: string, apiKey: string): Promise<string[]> {
  const prompt = `Analise a seguinte pergunta/mensagem do CEO e determine qual(is) conselheiro(s) do Board Virtual são mais adequados para responder.

CONSELHEIROS DISPONÍVEIS:
- CFO (Carlos Finance): Finanças, caixa, margem, EBITDA, custos, investimentos
- COO (Olivia Operations): Operações, processos, execução, capacidade, prazos
- CRO (Ricardo Revenue): Vendas, marketing, crescimento, pipeline, receita, churn
- CPO (Paula Product): Clientes, satisfação, NPS, CSAT, produto, experiência
- Board Chair (Bruno Board): Estratégia, visão sistêmica, governança, decisões críticas

MENSAGEM DO CEO:
"${message}"

Retorne APENAS os códigos dos conselheiros que devem responder, separados por vírgula.
Se a pergunta for geral ou estratégica, inclua Board Chair.
Se for sobre andamento de ações, inclua quem é mais relevante para o tema.
Máximo de 2 conselheiros, a menos que seja muito abrangente.

Resposta (apenas códigos):`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return ['Board Chair'];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'Board Chair';
    
    const validRoles = ['CFO', 'COO', 'CRO', 'CPO', 'Board Chair'];
    const mentioned = validRoles.filter(role => 
      content.toUpperCase().includes(role.toUpperCase()) ||
      content.includes(role.replace(' ', ''))
    );

    return mentioned.length > 0 ? mentioned.slice(0, 3) : ['Board Chair'];
  } catch (e) {
    console.error('Error determining advisors:', e);
    return ['Board Chair'];
  }
}

async function getAdvisorChatResponse(
  role: string,
  advisor: typeof ADVISORS[keyof typeof ADVISORS],
  session: any,
  previousOpinion: any,
  chatHistory: any[],
  userMessage: string,
  apiKey: string
): Promise<string> {
  const historyText = chatHistory.slice(-10).map(h => 
    h.role === 'user' 
      ? `CEO: ${h.message}`
      : `${h.advisor_name} (${h.advisor_role}): ${h.message}`
  ).join('\n\n');

  const systemPrompt = `Você é ${advisor.name}, ${role} do Board Virtual.

PERSONALIDADE: ${advisor.personality}
FOCO: ${advisor.focus}
ESTILO: ${advisor.style}

Você está em uma conversa contínua com o CEO sobre a decisão: "${session.decision_title}"

DESCRIÇÃO ORIGINAL: ${session.decision_description}

${previousOpinion ? `
SUA OPINIÃO ANTERIOR:
${previousOpinion.opinion}

Riscos que você identificou: ${previousOpinion.risks?.join(', ') || 'Nenhum'}
Oportunidades: ${previousOpinion.opportunities?.join(', ') || 'Nenhuma'}
Sua recomendação inicial: ${previousOpinion.recommendation}
` : ''}

RESUMO DO BOARD: ${session.board_summary || 'Análise em andamento'}
RECOMENDAÇÃO FINAL: ${session.final_recommendation || 'Pendente'}
DECISÃO DO CEO: ${session.ceo_decision || 'Não tomada ainda'}

REGRAS:
1. Responda de forma concisa e direta (máximo 3 parágrafos)
2. Mantenha sua personalidade e perspectiva do ${role}
3. Se o CEO perguntar sobre andamento, peça detalhes específicos
4. Ofereça insights práticos e acionáveis
5. Se necessário, faça perguntas de esclarecimento
6. Responda SEMPRE em português brasileiro`;

  const userPrompt = `${historyText ? `HISTÓRICO DA CONVERSA:\n${historyText}\n\n` : ''}NOVA MENSAGEM DO CEO:
"${userMessage}"

Responda como ${advisor.name} (${role}):`;

  try {
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
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua pergunta.';
  } catch (e) {
    console.error(`Error getting response from ${role}:`, e);
    return `Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.`;
  }
}
