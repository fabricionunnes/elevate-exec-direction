const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface SlideRequest {
  topic: string;
  audience?: string;
  duration_minutes?: number;
  content_level?: string;
}

interface GeneratedSlide {
  slide_number: number;
  slide_type: string;
  title: string;
  subtitle?: string;
  content: {
    bullets?: string[];
    text?: string;
    highlight?: string;
    question?: string;
    framework_name?: string;
    framework_steps?: string[];
    exercise_title?: string;
    exercise_instructions?: string;
    icon?: string;
  };
  speaker_notes?: string;
  layout_type: string;
}

async function generateSlides(request: SlideRequest): Promise<{ title: string; description: string; slides: GeneratedSlide[] }> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const levelLabels: Record<string, string> = {
    iniciante: "Iniciante - Conceitos básicos, linguagem simples, muitos exemplos",
    intermediario: "Intermediário - Conceitos aplicados, frameworks, estudos de caso",
    avancado: "Avançado - Estratégias complexas, análises profundas, exercícios desafiadores",
  };

  const slidesCount = Math.max(10, Math.min(25, Math.floor((request.duration_minutes || 30) / 3)));

  const systemPrompt = `Você é um especialista em criar apresentações de treinamento profissional para a Universidade Nacional de Vendas (UNV).

IDENTIDADE:
- A UNV é referência em Direção Comercial como Serviço
- Tom premium, autoritário e profissional
- Conteúdo prático, aplicável e orientado a resultados

REGRAS:
1. Crie uma narrativa lógica e progressiva
2. Use linguagem profissional mas acessível
3. Inclua exemplos reais do mercado comercial/vendas
4. Cada slide deve ter POUCO TEXTO e MUITO IMPACTO
5. Bullets devem ter no máximo 8-10 palavras cada
6. Varie os tipos de slides para manter engajamento
7. Inclua frameworks visuais, exercícios práticos e perguntas reflexivas
8. O conteúdo deve ser DENSO e VALIOSO, não superficial

TIPOS DE SLIDES DISPONÍVEIS:
- cover: Capa da apresentação
- intro: Introdução/agenda
- content: Conteúdo principal com bullets
- highlight: Destaque de frase/conceito importante
- framework: Framework ou metodologia visual
- example: Exemplo ou estudo de caso
- exercise: Exercício prático
- question: Pergunta reflexiva para a plateia
- data: Slide com dados/estatísticas
- quote: Citação inspiradora
- summary: Resumo/recapitulação
- closing: Encerramento/próximos passos

LAYOUTS DISPONÍVEIS:
- default: Layout padrão
- two-columns: Duas colunas
- centered: Conteúdo centralizado
- image-left: Imagem à esquerda
- image-right: Imagem à direita
- full-impact: Texto grande centralizado (para highlights)`;

  const userPrompt = `Crie uma apresentação de treinamento profissional com ${slidesCount} slides sobre:

TEMA: ${request.topic}
PÚBLICO-ALVO: ${request.audience || "Profissionais de vendas e gestores comerciais"}
NÍVEL: ${levelLabels[request.content_level || "intermediario"]}
DURAÇÃO: ${request.duration_minutes || 30} minutos

ESTRUTURA OBRIGATÓRIA:
1. Slide de CAPA (tipo: cover)
2. Slide de INTRODUÇÃO/AGENDA (tipo: intro)
3. Slide de CONTEXTO do tema (tipo: content)
4-${slidesCount - 3}. Slides de CONTEÚDO variado incluindo obrigatoriamente:
   - Pelo menos 2 frameworks/metodologias
   - Pelo menos 1 exercício prático
   - Pelo menos 2 perguntas reflexivas
   - Pelo menos 1 destaque/highlight
   - Exemplos e estudos de caso
${slidesCount - 2}. Slide de RESUMO (tipo: summary)
${slidesCount - 1}. Slide de PRÓXIMOS PASSOS (tipo: content)
${slidesCount}. Slide de ENCERRAMENTO (tipo: closing)

Retorne APENAS um JSON válido:
{
  "title": "Título da apresentação",
  "description": "Descrição curta da apresentação",
  "slides": [
    {
      "slide_number": 1,
      "slide_type": "cover",
      "title": "Título",
      "subtitle": "Subtítulo opcional",
      "content": {
        "bullets": ["ponto 1", "ponto 2"],
        "text": "texto adicional",
        "highlight": "frase de destaque",
        "question": "pergunta reflexiva",
        "framework_name": "Nome do framework",
        "framework_steps": ["Passo 1", "Passo 2"],
        "exercise_title": "Título do exercício",
        "exercise_instructions": "Instruções",
        "icon": "nome-do-icone-lucide"
      },
      "speaker_notes": "Notas para o apresentador",
      "layout_type": "default"
    }
  ]
}`;

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
      max_tokens: 15000,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
    if (response.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    const errorText = await response.text();
    console.error("AI API error:", errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content from AI");

  let parsed;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("No JSON found in response");
    }
  } catch (e) {
    console.error("Parse error:", e, "Content:", content.substring(0, 500));
    throw new Error("Failed to parse AI response");
  }

  return {
    title: parsed.title || request.topic,
    description: parsed.description || "",
    slides: parsed.slides || [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { topic, audience, duration_minutes, content_level } = body;

    if (!topic) {
      return new Response(
        JSON.stringify({ error: "Missing topic" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating slides for:", topic);
    const result = await generateSlides({ topic, audience, duration_minutes, content_level });
    console.log(`Generated ${result.slides.length} slides for: ${result.title}`);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate slides";
    const status = errorMessage.includes("Rate limit") ? 429 : errorMessage.includes("credits") ? 402 : 500;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
