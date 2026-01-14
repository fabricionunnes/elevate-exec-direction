import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, projectId } = await req.json();

    if (!companyId || !projectId) {
      throw new Error("companyId and projectId are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch complete company data
    const { data: company, error: companyError } = await supabase
      .from("onboarding_companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      throw new Error("Company not found");
    }

    // Fetch project info to get the service
    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .select("id, product_id, product_name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      throw new Error("Project not found");
    }

    // Fetch sales history
    const { data: salesHistory } = await supabase
      .from("company_sales_history")
      .select("month_year, revenue, sales_count")
      .eq("company_id", companyId)
      .order("month_year", { ascending: false })
      .limit(12);

    // Build complete briefing context
    const briefingContext = `
DADOS DA EMPRESA PARA ANÁLISE

👉 Contexto do negócio:
- Nome: ${company.name}
- Segmento: ${company.segment || "Não informado"}
- Descrição: ${company.company_description || "Não informada"}
- Website: ${company.website || "Não informado"}
- Instagram: ${company.instagram || "Não informado"}

👉 Produtos/Serviços:
${company.company_description || "Não informado"}

👉 Público-alvo / ICP:
${company.target_audience || "Não informado"}

👉 Modelo de vendas (B2B, B2C, híbrido):
Baseado no segmento: ${company.segment || "Não informado"}

👉 Equipe comercial atual:
- Tamanho: ${company.sales_team_size || "Não informado"}
- Estrutura: ${company.commercial_structure || "Não informada"}

👉 Canais de aquisição:
${company.acquisition_channels || "Não informado"}

👉 Faturamento médio e metas:
- Ticket Médio: ${company.average_ticket || "Não informado"}
- Taxa de Conversão: ${company.conversion_rate || "Não informada"}
- Meta de Crescimento: ${company.growth_target || "Não informada"}
- Expectativa 3 meses: ${company.growth_expectation_3m || "Não informada"}
- Expectativa 6 meses: ${company.growth_expectation_6m || "Não informada"}
- Expectativa 12 meses: ${company.growth_expectation_12m || "Não informada"}
${salesHistory && salesHistory.length > 0 ? `
Histórico de Vendas:
${salesHistory.map(s => `- ${s.month_year}: R$ ${s.revenue?.toLocaleString('pt-BR') || 0} (${s.sales_count || 0} vendas)`).join('\n')}
` : ''}

👉 Principais dores e gargalos:
${company.main_challenges || "Não informado"}

👉 Metas de curto prazo:
${company.goals_short_term || "Não informado"}

👉 Metas de longo prazo:
${company.goals_long_term || "Não informado"}

👉 Ferramentas existentes (CRM, marketing, etc.):
- Uso de CRM: ${company.crm_usage || "Não informado"}
- Ferramentas: ${company.tools_used || "Não informado"}
- Processo estruturado: ${company.has_structured_process || "Não informado"}
- Plano de metas: ${company.has_sales_goals || "Não informado"}

👉 Concorrentes:
${company.competitors || "Não informado"}

👉 Análise SWOT existente:
- Forças: ${company.swot_strengths || "Não informado"}
- Fraquezas: ${company.swot_weaknesses || "Não informado"}
- Oportunidades: ${company.swot_opportunities || "Não informado"}
- Ameaças: ${company.swot_threats || "Não informado"}

👉 OKRs:
- Objetivos com a UNV: ${company.objectives_with_unv || "Não informado"}
- Resultados-chave: ${company.key_results || "Não informado"}

👉 Expectativas com a consultoria ou planejamento:
Estruturar o setor comercial para crescimento sustentável e previsível.
`;

    const systemPrompt = `Você é um estrategista comercial sênior e consultor de crescimento, especialista em:

- Estruturação de times comerciais
- Processos de vendas e CRM
- Prospecção ativa e previsibilidade de faturamento
- Metas, indicadores (KPIs) e rotinas de gestão
- Treinamento e desenvolvimento de equipes de vendas
- Crescimento sustentável em empresas de pequeno e médio porte

Você pensa como diretor comercial, com visão de negócio, foco em execução e disciplina operacional.

OBJETIVO DO PEDIDO

Com base nas informações da empresa fornecidas abaixo, quero que você entregue, de forma estruturada e prática:

1. Resumo Executivo do Negócio
2. Análise SWOT Estratégica
3. Plano de Ação Comercial Completo, focado em estruturar ou reestruturar o setor comercial

DIRETRIZES GERAIS (OBRIGATÓRIAS)

- Linguagem executiva, clara e estratégica
- Nada genérico ou teórico demais
- Sempre conectar problema → ação → impacto esperado
- Pensar em processos simples, executáveis e mensuráveis
- Considerar cenários com:
  - Equipe comercial enxuta
  - Falta de previsibilidade de vendas
  - Dependência excessiva de poucos canais
  - Necessidade de padronização de atendimento
- Priorizar disciplina comercial, rotina e acompanhamento
- Assumir que o dono/gestor não pode estar no operacional o tempo todo

TOM E POSTURA

- Consultivo
- Estratégico
- Orientado à execução
- Sem "blá-blá-blá corporativo"
- Com clareza de o que fazer, por que fazer e como fazer`;

    const userPrompt = `${briefingContext}

FORMATO DA RESPOSTA

Responda em formato Markdown estruturado:

# RESUMO EXECUTIVO DA EMPRESA

Apresente uma visão clara e estratégica contendo:
- Modelo de negócio
- Público-alvo / ICP
- Proposta de valor
- Diferenciais competitivos
- Situação atual do comercial
- Principais desafios e gargalos

# ANÁLISE SWOT ESTRATÉGICA

Organize em quatro blocos:

## 🔹 Forças
(liste e comente o impacto em vendas, gestão comercial, conversão, crescimento)

## 🔹 Fraquezas
(liste e comente o impacto)

## 🔹 Oportunidades
(liste e comente o impacto)

## 🔹 Ameaças
(liste e comente o impacto e risco do negócio)

# PLANO DE AÇÃO COMERCIAL ESTRUTURADO

Para cada frente estratégica, apresente:

## [Nome da Frente]
**Objetivo:** [objetivo da frente]

**Ações práticas:**
1. [ação 1]
2. [ação 2]
3. [ação 3]

**Responsável sugerido:** [ex: gestor, vendedor, SDR, marketing]
**Prazo:** [curto, médio, contínuo]
**Resultado esperado:** [impacto em vendas, previsibilidade ou eficiência]

---

Inclua frentes como:
- Implementação do playbook comercial e calendário de treinamentos
- Implementação do calendário de ações mensal e postagens no Instagram
- Implementação de meta de vendas
- Implementação do CRM com pipeline para gestão de leads
- Implementação do fluxo de follow up
- Implementação do plano de metas de vendas
- Implementação do grupo VIP
- Implementação do tráfego pago
- Implementar social selling
- Implementar sistema de indicação

# PRIORIDADES E CRONOGRAMA

## Primeiros 30 dias
[liste as prioridades]

## 31-60 dias
[liste as prioridades]

## 61-90 dias
[liste as prioridades]

## Riscos de não execução
[liste os principais riscos]

## Alavancas rápidas de resultado
[destaque ações de impacto rápido]`;

    // Call Lovable AI
    console.log("Calling AI to generate strategic plan...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to generate strategic plan with AI");
    }

    const aiData = await aiResponse.json();
    const strategicPlan = aiData.choices?.[0]?.message?.content;

    if (!strategicPlan) {
      throw new Error("Empty response from AI");
    }

    console.log("Strategic plan generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        strategicPlan,
        companyName: company.name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error in generate-strategic-plan:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
