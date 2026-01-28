import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

  const systemPrompt = `Você é um especialista em criar apresentações profissionais de consultoria comercial para a Universidade Vendas (UNV). 

REGRAS OBRIGATÓRIAS:
1. Crie uma narrativa lógica e envolvente
2. Adapte a linguagem ao público: ${audienceLabels[briefing.audience] || briefing.audience}
3. Mantenha o nível de profundidade: ${depthLabels[briefing.depth_level] || briefing.depth_level}
4. Use o tom: ${toneLabels[briefing.tone] || briefing.tone}
5. NÃO use textos genéricos - seja específico e impactante
6. Slides devem ter pouco texto e muito impacto visual
7. Inclua perguntas estratégicas e momentos de reflexão
8. Priorize clareza e fluidez na narrativa

ESTRUTURA OBRIGATÓRIA:
- Slide de capa (sempre primeiro)
- Contexto da reunião
- Objetivo do encontro  
- Cenário atual / Status
- Conteúdo principal (vários slides)
- Análises e insights
- Propostas ou soluções
- Próximos passos
- Encerramento

TIPOS DE SLIDES INTERATIVOS (use pelo menos 2-3):
- question: Pergunta estratégica para o cliente refletir
- reflection: Slide de reflexão com insight provocador
- decision: Slide de decisão com opções A/B
- highlight: Destaque de número ou métrica-chave`;

  const userPrompt = `Crie uma apresentação profissional com ${slidesCount} slides para:

EMPRESA: ${briefing.company_name}
DATA: ${briefing.meeting_date}
ASSUNTO: ${briefing.subject}
TEMA CENTRAL: ${briefing.central_theme}
OBJETIVO: ${objectiveLabels[briefing.objective] || briefing.objective}
DURAÇÃO: ${briefing.estimated_duration_minutes} minutos

${briefing.key_metrics ? `MÉTRICAS IMPORTANTES:\n${briefing.key_metrics}` : ''}
${briefing.must_include_points ? `PONTOS OBRIGATÓRIOS:\n${briefing.must_include_points}` : ''}

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

Tipos de slide: cover, context, objective, status, content, data, insight, proposal, next_steps, closing, interactive
Tipos interativos: question, reflection, decision, highlight`;

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
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
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
