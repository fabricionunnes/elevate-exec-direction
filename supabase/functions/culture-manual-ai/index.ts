import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é a IA de Cultura Organizacional da UNV (Universidade Nacional de Vendas).

Seu objetivo é transformar as respostas do formulário de cultura empresarial em um MANUAL DE CULTURA completo, institucional, inspirador e acionável.

DIRETRIZES DE ESCRITA:
1. Tom: Profissional, inspirador, mas acessível
2. Linguagem: Português brasileiro formal, mas envolvente
3. Estrutura: Use parágrafos curtos, bullets quando apropriado
4. Conteúdo: Baseado nas respostas, mas expandido de forma profissional
5. Evite: Clichês corporativos vazios, termos em inglês desnecessários

FORMATO DO CONTEÚDO:
- Use markdown para formatação
- Inclua citações inspiradoras quando relevante
- Crie subtópicos quando o conteúdo for extenso
- Mantenha cada seção entre 200-500 palavras

IMPORTANTE:
- Preserve a essência e personalidade da empresa
- Expanda conceitos simples em diretrizes acionáveis
- Conecte valores com comportamentos práticos
- Seja específico, não genérico`;

async function generateWithAI(prompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  
  const response = await fetch("https://api.lovable.dev/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI generation failed: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function buildSectionPrompt(sectionKey: string, formResponse: any): string {
  const prompts: Record<string, string> = {
    cover: `Crie um texto curto e impactante para a capa do manual de cultura.
Nome da empresa: [A ser definido pela empresa]
Ano: ${new Date().getFullYear()}
Apenas retorne uma frase de impacto sobre cultura organizacional.`,

    presentation: `Com base nas informações abaixo, crie uma APRESENTAÇÃO INSTITUCIONAL calorosa e inspiradora.

INFORMAÇÕES:
- Propósito: ${formResponse.company_purpose || "Não informado"}
- História: ${formResponse.company_history || "Não informado"}

Escreva um texto de boas-vindas que:
1. Acolha o leitor
2. Explique a importância deste manual
3. Convide à leitura com entusiasmo`,

    history: `Crie a seção HISTÓRIA DA EMPRESA baseado em:

- História da empresa: ${formResponse.company_history || "Não informado"}
- História de fundação: ${formResponse.founding_story || "Não informado"}
- Motivação dos fundadores: ${formResponse.founders_motivation || "Não informado"}

Escreva uma narrativa envolvente que conte a jornada da empresa desde o início.`,

    purpose: `Crie a seção PROPÓSITO E RAZÃO DE EXISTIR baseado em:

- Propósito: ${formResponse.company_purpose || "Não informado"}
- Aspiração de legado: ${formResponse.legacy_aspiration || "Não informado"}

Explique por que a empresa existe além do lucro e qual impacto busca gerar.`,

    mission_vision_values: `Crie a seção MISSÃO, VISÃO E VALORES baseado em:

- Missão: ${formResponse.mission_statement || "Não informado"}
- Visão: ${formResponse.vision_statement || "Não informado"}
- Valores: ${formResponse.core_values || "Não informado"}

Estruture com:
1. Declaração de Missão (clara e memorável)
2. Declaração de Visão (ambiciosa mas alcançável)
3. Valores Centrais (com breve descrição de cada)`,

    cultural_principles: `Crie a seção PRINCÍPIOS CULTURAIS baseado em:

- Princípios culturais: ${formResponse.cultural_principles || "Não informado"}
- Propósito: ${formResponse.company_purpose || "Não informado"}

Liste e explique os princípios que guiam todas as decisões na empresa.`,

    behavior_code: `Crie a seção CÓDIGO DE COMPORTAMENTO baseado em:

- Comportamentos esperados: ${formResponse.expected_behaviors || "Não informado"}
- Comportamentos inaceitáveis: ${formResponse.unacceptable_behaviors || "Não informado"}

Estruture em:
1. O que valorizamos (comportamentos positivos)
2. O que não toleramos (limites claros)`,

    leadership_model: `Crie a seção MODELO DE LIDERANÇA baseado em:

- Estilo de liderança: ${formResponse.leadership_style || "Não informado"}
- Expectativas de liderança: ${formResponse.leadership_expectations || "Não informado"}

Descreva como os líderes devem atuar na empresa.`,

    performance_culture: `Crie a seção CULTURA DE PERFORMANCE E RESULTADOS baseado em:

- Cultura de performance: ${formResponse.performance_culture || "Não informado"}
- Meritocracia: ${formResponse.meritocracy_principles || "Não informado"}
- Reconhecimento: ${formResponse.recognition_approach || "Não informado"}

Explique como a empresa equilibra resultados com bem-estar.`,

    communication: `Crie a seção COMUNICAÇÃO INTERNA baseado em:

- Estilo de comunicação: ${formResponse.communication_style || "Não informado"}
- Comunicação interna: ${formResponse.internal_communication || "Não informado"}

Descreva os padrões de comunicação esperados.`,

    client_relationship: `Crie a seção RELACIONAMENTO COM CLIENTES baseado em:

- Relacionamento com clientes: ${formResponse.client_relationship || "Não informado"}
- Visão da experiência do cliente: ${formResponse.client_experience_vision || "Não informado"}

Explique como a empresa deve tratar seus clientes.`,

    people_growth: `Crie a seção PESSOAS, CRESCIMENTO E RECONHECIMENTO baseado em:

- Oportunidades de crescimento: ${formResponse.growth_opportunities || "Não informado"}
- Reconhecimento: ${formResponse.recognition_approach || "Não informado"}

Descreva como a empresa investe em seu time.`,

    expectations: `Crie a seção O QUE ESPERAMOS DE QUEM FAZ PARTE DO TIME baseado em:

- Membro ideal: ${formResponse.ideal_team_member || "Não informado"}
- Quem não deve entrar: ${formResponse.who_should_not_join || "Não informado"}

Seja claro sobre o perfil cultural esperado.`,

    future: `Crie a seção O FUTURO DA EMPRESA baseado em:

- Visão de futuro: ${formResponse.company_future_vision || "Não informado"}
- Aspiração de legado: ${formResponse.legacy_aspiration || "Não informado"}

Inspire com a visão de longo prazo.`,

    final_message: `Crie a seção MENSAGEM FINAL DA LIDERANÇA baseado em:

- Mensagem final: ${formResponse.final_leadership_message || "Não informado"}
- Propósito: ${formResponse.company_purpose || "Não informado"}

Encerre o manual com uma mensagem pessoal e inspiradora da liderança.`,
  };

  return prompts[sectionKey] || `Crie conteúdo para a seção: ${sectionKey}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, projectId, sectionKey, formResponse } = await req.json();

    if (action === "generate_full_manual") {
      console.log("Generating full manual for project:", projectId);
      
      const sections = [];
      const sectionKeys = [
        "cover", "presentation", "history", "purpose", "mission_vision_values",
        "cultural_principles", "behavior_code", "leadership_model", 
        "performance_culture", "communication", "client_relationship",
        "people_growth", "expectations", "future", "final_message"
      ];

      for (const key of sectionKeys) {
        console.log(`Generating section: ${key}`);
        const prompt = buildSectionPrompt(key, formResponse);
        const content = await generateWithAI(prompt);
        sections.push({ key, content });
      }

      return new Response(
        JSON.stringify({ success: true, sections }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "regenerate_section") {
      console.log(`Regenerating section ${sectionKey} for project:`, projectId);
      
      const prompt = buildSectionPrompt(sectionKey, formResponse);
      const content = await generateWithAI(prompt);

      return new Response(
        JSON.stringify({ success: true, content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in culture-manual-ai:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
