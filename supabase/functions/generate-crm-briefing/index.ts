// generate-crm-briefing - no external deps needed

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription, leadName, companyName } = await req.json();

    if (!transcription) {
      return new Response(
        JSON.stringify({ error: "Transcrição é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const systemPrompt = `Você é um especialista em vendas B2B e consultoria empresarial. Sua tarefa é analisar transcrições de reuniões comerciais e gerar um briefing executivo completo e estruturado.

O briefing deve ser objetivo, profissional e conter as seguintes seções:

## RESUMO EXECUTIVO
- Síntese do que foi discutido em 2-3 frases

## CONTEXTO DO CLIENTE
- Situação atual da empresa
- Principais desafios identificados
- Motivações para buscar a solução

## NECESSIDADES IDENTIFICADAS
- Liste as principais necessidades e dores mencionadas
- Priorize por urgência/importância

## EXPECTATIVAS DO CLIENTE
- O que o cliente espera alcançar
- Prazos mencionados
- Métricas de sucesso desejadas

## OBJEÇÕES E PREOCUPAÇÕES
- Objeções levantadas durante a conversa
- Preocupações sobre implementação, preço, tempo, etc.

## PRÓXIMOS PASSOS
- Ações acordadas
- Compromissos assumidos
- Próximas reuniões ou follow-ups

## PONTOS DE ATENÇÃO
- Informações importantes para o fechamento
- Stakeholders mencionados
- Concorrência ou alternativas consideradas

Seja conciso mas completo. Use bullet points. Se alguma informação não estiver presente na transcrição, indique "Não mencionado".`;

    const userPrompt = `Analise a seguinte transcrição de reunião comercial e gere um briefing completo:

${companyName ? `**Empresa:** ${companyName}` : ""}
${leadName ? `**Contato:** ${leadName}` : ""}

---

**TRANSCRIÇÃO:**

${transcription}

---

Gere o briefing seguindo a estrutura solicitada.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const briefing = data.choices?.[0]?.message?.content;

    if (!briefing) {
      throw new Error("Resposta vazia da IA");
    }

    return new Response(
      JSON.stringify({ briefing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating briefing:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
