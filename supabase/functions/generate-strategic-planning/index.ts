import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em Planejamento Estratégico e Estruturação Comercial no padrão UNV. Sua tarefa é transformar as respostas do cliente em: (1) Resumo completo da empresa; (2) Análise SWOT com 10 itens por quadrante; (3) Cronograma de ações detalhado com ações e subações.

REGRAS GERAIS

- Linguagem executiva, direta e sem emojis.

- Não inserir comentários, justificativas, dicas ou observações fora do escopo.

- Sempre entregar os 3 blocos completos, nesta ordem: Resumo, SWOT, Cronograma.

- Quando faltar algum dado, preencha apenas com "Não informado".

BLOCO 1 – RESUMO COMPLETO DA EMPRESA

Formato fixo:

BUSINESS:

ICP:

PRODUTOS / SERVIÇOS:

FATURAMENTO ATUAL:

SÓCIOS E DONOS:

EQUIPE DE VENDAS:

CANAIS DE VENDAS:

INVESTIMENTO EM TRÁFEGO / LEADS / CONVERSÃO:

DORES PRINCIPAIS (7):

EXPECTATIVAS (7):

INSTAGRAM:

SITE:

BLOCO 2 – ANÁLISE SWOT

Gerar exatamente 10 itens por quadrante. A ordem deve refletir prioridade interna:

- FRAQUEZAS e AMEAÇAS: ordenar do mais urgente ao menos urgente (não exibir urgência).

- OPORTUNIDADES: ordenar da implementação mais fácil para a mais complexa (não exibir facilidade).

- FORÇAS: ordenar por relevância estratégica.

Formato:

FORÇAS

1.

...

10.

FRAQUEZAS

1.

...

10.

OPORTUNIDADES

1.

...

10.

AMEAÇAS

1.

...

10.

BLOCO 3 – CRONOGRAMA DE AÇÕES DETALHADO

Listar as ações abaixo, cada uma com subações práticas, claras e executáveis. Não usar prazos relativos a datas, apenas sequência lógica e rotina. Ações obrigatórias:

1. Criar playbook comercial e treinar equipe

Criar calendário de treinamentos

2. Implantar CRM com pipeline

3. Criar fluxo de follow-up curto, médio e longo prazo

4. Criar campanha de vendas agressiva 30 dias

5. Criar alinhamento de rotina para equipe comercial e gerência

6. Criar plano de metas e comissão

7. Mapear indicadores de desempenho de cada função no comercial

8. Criar plano de endomarketing com ações de incentivo diárias

9. Estruturar processos de upsell, cross-sell e fidelização

10. Analisar indicadores do tráfego pago

11. Implementar social selling para prospecção

12. Implementar sistema de indicação imediata pós-venda

13. Implementar sistema de parcerias para geração de leads`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefingData, companyName } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the user prompt with all briefing data
    const userPrompt = `
Dados do briefing da empresa "${companyName}":

INFORMAÇÕES BÁSICAS:
- Nome da empresa: ${briefingData.name || "Não informado"}
- Segmento: ${briefingData.segment || "Não informado"}
- Website: ${briefingData.website || "Não informado"}
- Instagram: ${briefingData.instagram || "Não informado"}

DESCRIÇÃO DA EMPRESA:
${briefingData.company_description || "Não informado"}

PÚBLICO-ALVO / ICP:
${briefingData.target_audience || "Não informado"}

CONCORRENTES:
${briefingData.competitors || "Não informado"}

PRINCIPAIS DESAFIOS / DORES:
${briefingData.main_challenges || "Não informado"}

METAS DE CURTO PRAZO:
${briefingData.goals_short_term || "Não informado"}

METAS DE LONGO PRAZO:
${briefingData.goals_long_term || "Não informado"}

DIAGNÓSTICO COMERCIAL (KICKOFF):
- Vendedores ativos: ${briefingData.sales_team_size || "Não informado"}
- Taxa de conversão: ${briefingData.conversion_rate || "Não informado"}
- Ticket médio: ${briefingData.average_ticket || "Não informado"}
- Canais de aquisição: ${briefingData.acquisition_channels || "Não informado"}
- Processo estruturado: ${briefingData.has_structured_process || "Não informado"}
- Uso do CRM: ${briefingData.crm_usage || "Não informado"}
- Plano de metas: ${briefingData.has_sales_goals || "Não informado"}

ESTRUTURA COMERCIAL:
${briefingData.commercial_structure || "Não informado"}

META DE CRESCIMENTO:
${briefingData.growth_target || "Não informado"}

FERRAMENTAS UTILIZADAS:
${briefingData.tools_used || "Não informado"}

SWOT (dados existentes do cliente, se houver):
- Forças: ${briefingData.swot_strengths || "Não informado"}
- Fraquezas: ${briefingData.swot_weaknesses || "Não informado"}
- Oportunidades: ${briefingData.swot_opportunities || "Não informado"}
- Ameaças: ${briefingData.swot_threats || "Não informado"}

OBJETIVOS COM A UNV:
${briefingData.objectives_with_unv || "Não informado"}

RESULTADOS-CHAVE ESPERADOS:
${briefingData.key_results || "Não informado"}

EXPECTATIVAS DE CRESCIMENTO:
- 3 meses: ${briefingData.growth_expectation_3m || "Não informado"}
- 6 meses: ${briefingData.growth_expectation_6m || "Não informado"}
- 12 meses: ${briefingData.growth_expectation_12m || "Não informado"}

Por favor, gere o planejamento estratégico completo conforme os 3 blocos especificados.
`;

    console.log("Generating strategic planning for:", companyName);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Use a higher output budget to avoid truncating before BLOCO 3
        model: "google/gemini-3-flash-preview",
        max_tokens: 6000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Error generating strategic planning:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
