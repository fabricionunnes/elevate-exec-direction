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

    const systemPrompt = `Você é um analista sênior de vendas B2B especializado em gerar briefings executivos a partir de transcrições de reuniões comerciais.

Sua missão é transformar transcrições brutas em documentos claros, acionáveis e bem formatados em Markdown.

REGRAS DE FORMATAÇÃO:
- Use títulos com ## para seções principais
- Use **negrito** para termos-chave e nomes de pessoas/empresas
- Use listas com • (bullet) para itens, nunca parágrafos longos
- Use > blockquote para citações diretas relevantes do cliente
- Separe seções com uma linha em branco
- Seja direto e objetivo — sem enrolação
- Cada bullet deve conter UMA informação clara
- Se uma informação não foi mencionada, OMITA a seção (não escreva "Não mencionado")

ESTRUTURA DO BRIEFING:

## 📋 Resumo Executivo
Síntese de 2-3 frases do encontro: quem participou, objetivo e resultado principal.

## 🏢 Perfil do Cliente
• Segmento de atuação
• Porte / número de colaboradores
• Principais produtos/serviços
• Momento atual da empresa

## 🎯 Necessidades e Dores
• Liste cada dor/necessidade em um bullet separado
• Priorize por urgência (mais urgente primeiro)
• Inclua o contexto que motivou cada dor

## 💡 Solução Apresentada
• O que foi proposto durante a reunião
• Funcionalidades ou serviços destacados
• Como a solução endereça cada dor listada

## ⚠️ Objeções e Preocupações
• Cada objeção em um bullet separado
• Inclua como foi (ou não) contornada

## 💰 Informações Comerciais
• Orçamento mencionado ou faixa de investimento
• Prazo de decisão
• Decisores e influenciadores envolvidos
• Concorrentes ou alternativas consideradas

## ✅ Próximos Passos
• Ações específicas com responsável e prazo (se mencionado)
• Follow-ups acordados
• Materiais ou propostas a enviar

## 🔑 Insights Estratégicos
• Gatilhos emocionais ou racionais identificados
• Nível de interesse/urgência percebido (Alto/Médio/Baixo)
• Recomendação para abordagem no próximo contato`;

    const userPrompt = `Gere o briefing executivo da seguinte reunião comercial:

${companyName ? `**Empresa:** ${companyName}` : ""}
${leadName ? `**Contato principal:** ${leadName}` : ""}

---

**TRANSCRIÇÃO COMPLETA:**

${transcription}

---

Gere o briefing seguindo rigorosamente a estrutura e formatação solicitadas. Seja preciso e extraia o máximo de informações úteis.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${LOVABLE_API_KEY}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.25,
        max_tokens: 4000,
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
