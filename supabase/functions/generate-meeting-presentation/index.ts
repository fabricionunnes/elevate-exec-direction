// generate-meeting-presentation - no external deps needed

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface CompanyContext {
  company_name: string;
  company_segment?: string;
  company_description?: string;
  main_challenges?: string;
  short_term_goals?: string;
  // Note: Internal metrics (contract_value, health_score, nps_score) are excluded
  // to avoid exposing confidential data in client-facing presentations
}

interface MeetingHistory {
  date: string;
  title: string;
  summary?: string;
  decisions?: string;
  next_steps?: string;
}

interface TaskContext {
  title: string;
  description?: string;
  status: string;
  phase?: string;
}

interface BriefingContext {
  date: string;
  content: string;
}

interface PresentationBriefing {
  subject: string;
  central_theme: string;
  objective: string;
  audience: string;
  depth_level: string;
  estimated_duration_minutes: number;
  key_metrics?: string;
  must_include_points?: string;
  tone: string;
  company_name: string;
  meeting_date: string;
  // Rich context
  company_context?: CompanyContext;
  meeting_history?: MeetingHistory[];
  previous_briefings?: BriefingContext[];
  project_tasks?: TaskContext[];
}

interface Slide {
  slide_number: number;
  slide_type: string;
  title: string;
  subtitle?: string;
  content: {
    bullets?: string[];
    text?: string;
    question?: string;
    options?: string[];
    highlight?: string;
    metric_value?: string;
    metric_label?: string;
  };
  is_interactive: boolean;
  interactive_type?: string;
}

function formatMeetingHistory(meetings: MeetingHistory[]): string {
  if (!meetings?.length) return "Nenhuma reunião anterior registrada.";
  
  return meetings.slice(0, 5).map(m => {
    let text = `📅 ${m.date} - ${m.title}`;
    if (m.summary) text += `\n   Resumo: ${m.summary.substring(0, 300)}...`;
    if (m.decisions) text += `\n   Decisões: ${m.decisions.substring(0, 200)}`;
    if (m.next_steps) text += `\n   Próximos passos: ${m.next_steps.substring(0, 200)}`;
    return text;
  }).join("\n\n");
}

function formatTasks(tasks: TaskContext[]): string {
  if (!tasks?.length) return "Nenhuma tarefa registrada.";
  
  const grouped: Record<string, TaskContext[]> = {};
  tasks.forEach(t => {
    const phase = t.phase || "Geral";
    if (!grouped[phase]) grouped[phase] = [];
    grouped[phase].push(t);
  });

  return Object.entries(grouped).map(([phase, phaseTasks]) => {
    const taskList = phaseTasks.slice(0, 5).map(t => 
      `  - ${t.title} (${t.status})${t.description ? `: ${t.description.substring(0, 100)}` : ''}`
    ).join("\n");
    return `📋 ${phase}:\n${taskList}`;
  }).join("\n\n");
}

function formatBriefings(briefings: BriefingContext[]): string {
  if (!briefings?.length) return "";
  
  return briefings.slice(0, 3).map(b => 
    `📝 Briefing de ${b.date}:\n${b.content.substring(0, 500)}...`
  ).join("\n\n");
}

function formatCompanyContext(ctx?: CompanyContext): string {
  if (!ctx) return "";
  
  const lines: string[] = [];
  if (ctx.company_segment) lines.push(`Segmento: ${ctx.company_segment}`);
  if (ctx.company_description) lines.push(`Descrição: ${ctx.company_description}`);
  if (ctx.main_challenges) lines.push(`Principais desafios: ${ctx.main_challenges}`);
  if (ctx.short_term_goals) lines.push(`Metas de curto prazo: ${ctx.short_term_goals}`);
  // Internal metrics are intentionally excluded from presentations
  
  return lines.length ? lines.join("\n") : "";
}

async function generatePresentation(briefing: PresentationBriefing): Promise<Slide[]> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const objectiveLabels: Record<string, string> = {
    diagnostico: "Diagnóstico",
    alinhamento: "Alinhamento",
    planejamento: "Planejamento",
    resultados: "Apresentação de Resultados",
    decisao: "Tomada de Decisão"
  };

  const audienceLabels: Record<string, string> = {
    empresario: "Empresário/Sócio",
    diretoria: "Diretoria",
    gestores: "Gestores",
    time_operacional: "Time Operacional"
  };

  const depthLabels: Record<string, string> = {
    estrategico: "Estratégico",
    tatico: "Tático",
    operacional: "Operacional"
  };

  const toneLabels: Record<string, string> = {
    institucional: "Institucional e formal",
    consultivo: "Consultivo e didático",
    provocativo: "Provocativo e desafiador",
    inspirador: "Inspirador e motivacional"
  };

  // Calculate number of slides based on duration
  const slidesCount = Math.max(8, Math.min(20, Math.floor(briefing.estimated_duration_minutes / 5)));

  // Build rich context sections
  const companyContextStr = formatCompanyContext(briefing.company_context);
  const meetingHistoryStr = formatMeetingHistory(briefing.meeting_history || []);
  const tasksStr = formatTasks(briefing.project_tasks || []);
  const briefingsStr = formatBriefings(briefing.previous_briefings || []);

  const systemPrompt = `Você é um especialista em criar apresentações profissionais de consultoria comercial para a Universidade Vendas (UNV). 

REGRAS OBRIGATÓRIAS:
1. Crie uma narrativa lógica e envolvente baseada no CONTEXTO REAL da empresa
2. USE AS INFORMAÇÕES DO HISTÓRICO para criar continuidade e relevância
3. REFERENCIE decisões e compromissos de reuniões anteriores
4. Adapte a linguagem ao público: ${audienceLabels[briefing.audience] || briefing.audience}
5. Mantenha o nível de profundidade: ${depthLabels[briefing.depth_level] || briefing.depth_level}
6. Use o tom: ${toneLabels[briefing.tone] || briefing.tone}
7. NÃO use textos genéricos - seja específico com dados reais da empresa
8. MENCIONE tarefas em andamento e próximos passos concretos
9. Slides devem ter pouco texto e muito impacto visual
10. Inclua perguntas estratégicas baseadas no contexto real

DADOS CONFIDENCIAIS - NUNCA MENCIONE:
- Health Score, saúde do cliente, ou qualquer pontuação interna
- Valores de contrato, mensalidade, ou termos financeiros do acordo
- Tempo de contrato, data de início/fim do contrato
- NPS, notas de satisfação internas
- Qualquer métrica interna da UNV sobre o cliente

ESTRUTURA OBRIGATÓRIA:
- Slide de capa (sempre primeiro)
- Contexto da reunião (conectando com o histórico)
- Objetivo do encontro  
- Cenário atual / Status (com dados reais se disponíveis)
- Acompanhamento de ações anteriores (se houver histórico)
- Conteúdo principal (vários slides)
- Análises e insights
- Propostas ou soluções
- Próximos passos concretos
- Encerramento

TIPOS DE SLIDES INTERATIVOS (use pelo menos 2-3):
- question: Pergunta estratégica para o cliente refletir
- reflection: Slide de reflexão com insight provocador
- decision: Slide de decisão com opções A/B
- highlight: Destaque de número ou métrica-chave`;

  const userPrompt = `Crie uma apresentação profissional com ${slidesCount} slides para:

=== DADOS DA REUNIÃO ===
EMPRESA: ${briefing.company_name}
DATA: ${briefing.meeting_date}
ASSUNTO: ${briefing.subject}
TEMA CENTRAL: ${briefing.central_theme}
OBJETIVO: ${objectiveLabels[briefing.objective] || briefing.objective}
DURAÇÃO: ${briefing.estimated_duration_minutes} minutos

${briefing.key_metrics ? `=== MÉTRICAS IMPORTANTES ===\n${briefing.key_metrics}\n` : ''}
${briefing.must_include_points ? `=== PONTOS OBRIGATÓRIOS ===\n${briefing.must_include_points}\n` : ''}

${companyContextStr ? `=== CONTEXTO DA EMPRESA ===\n${companyContextStr}\n` : ''}

=== HISTÓRICO DE REUNIÕES ANTERIORES ===
${meetingHistoryStr}

${briefingsStr ? `=== BRIEFINGS ANTERIORES ===\n${briefingsStr}\n` : ''}

=== TAREFAS E TRILHAS DO PROJETO ===
${tasksStr}

INSTRUÇÕES ESPECIAIS:
1. USE as informações acima para criar uma apresentação PERSONALIZADA e RELEVANTE
2. Se houver decisões pendentes de reuniões anteriores, mencione-as
3. Se houver tarefas em andamento, inclua um slide de acompanhamento
4. Crie perguntas de reflexão baseadas nos desafios reais da empresa
5. Proponha próximos passos concretos e mensuráveis

Retorne APENAS um JSON válido com array de slides no formato:
{
  "slides": [
    {
      "slide_number": 1,
      "slide_type": "cover",
      "title": "Título do slide",
      "subtitle": "Subtítulo opcional",
      "content": {
        "bullets": ["ponto 1", "ponto 2"],
        "text": "texto adicional",
        "question": "pergunta para slides interativos",
        "options": ["Opção A", "Opção B"],
        "highlight": "destaque principal",
        "metric_value": "R$ 1.2M",
        "metric_label": "Faturamento Mensal"
      },
      "is_interactive": false,
      "interactive_type": null
    }
  ]
}

Tipos de slide: cover, context, objective, status, followup, content, data, insight, proposal, next_steps, closing, interactive
Tipos interativos: question, reflection, decision, highlight`;

  console.log("Generating with rich context:", {
    company: briefing.company_name,
    meetingsCount: briefing.meeting_history?.length || 0,
    tasksCount: briefing.project_tasks?.length || 0,
    briefingsCount: briefing.previous_briefings?.length || 0,
  });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 10000,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue.");
    }
    const errorText = await response.text();
    console.error("AI API error:", errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content from AI");
  }

  // Parse JSON from response
  let parsed;
  try {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("No JSON found in response");
    }
  } catch (e) {
    console.error("Parse error:", e, "Content:", content);
    throw new Error("Failed to parse AI response");
  }

  return parsed.slides || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { briefing } = await req.json();

    if (!briefing) {
      return new Response(
        JSON.stringify({ error: "Missing briefing data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating presentation for:", briefing.subject);

    const slides = await generatePresentation(briefing);

    console.log(`Generated ${slides.length} slides`);

    return new Response(
      JSON.stringify({ success: true, slides }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate presentation";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
