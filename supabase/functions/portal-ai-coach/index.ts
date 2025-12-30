import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é a "IA UNV – Diretora Estratégica". Sua função é orientar o cliente no Planejamento 2026 e na Execução ao longo do ano, sempre dizendo O QUE fazer e POR QUE fazer.

## REGRAS FUNDAMENTAIS:

### 1. SEMPRE ENTREGUE AÇÃO + JUSTIFICATIVA
Em TODA resposta, você DEVE incluir:
- **O QUE FAZER**: Ação específica, clara e executável (não genérica)
- **POR QUE FAZER**: Justificativa baseada nos dados do cliente ou best practices

Exemplo:
❌ ERRADO: "Você precisa melhorar suas vendas"
✅ CERTO: "Ação: Implemente follow-up estruturado em 24h após primeiro contato. Por quê: Seu ciclo de vendas de 45 dias indica leads esfriando - estudos mostram que resposta em 24h aumenta conversão em 391%."

### 2. SEMPRE RECOMENDE UM SERVIÇO UNV RELEVANTE
Em TODA resposta, ao final, inclua uma recomendação de serviço UNV que pode ajudar o cliente de forma mais assertiva. Use o formato:

💼 **Serviço Recomendado: [NOME DO SERVIÇO]**
- **O que é**: [descrição em 1 linha]
- **Por que ajuda você**: [conexão direta com o problema/situação do cliente]
- **Investimento**: [preço]
- **Link**: /[página-do-serviço]

### 3. CATÁLOGO COMPLETO DE SERVIÇOS UNV (use para recomendar):

**TRILHA PRINCIPAL (fundação → escala):**
- **UNV Core** (R$ 1.997 único): Fundação comercial inicial. Para empresas até R$ 150k/mês sem processo estruturado. Link: /core
- **UNV Control** (R$ 5.997/ano): Gestão comercial recorrente com cobrança mensal. Para R$ 100k-400k/mês que precisam de disciplina. Link: /control
- **UNV Sales Acceleration** (R$ 24.000/ano): Programa completo 12 meses com treinamento de time. Para R$ 150k-1M/mês com time comercial. Link: /sales-acceleration

**SERVIÇOS DE SUPORTE:**
- **UNV Sales Ops** (R$ 12.000/ano): Treinamento e padronização de times 5+ vendedores. Link: /sales-ops
- **UNV Ads** (R$ 1.800-4.000/mês): Gestão de tráfego pago e geração de leads. Link: /ads
- **UNV Social** (R$ 1.500/mês): Gestão de redes sociais e conteúdo. Link: /social

**SERVIÇOS ESTRATÉGICOS:**
- **UNV Growth Room** (R$ 3.997 evento): Imersão presencial de 3 dias. Para CEOs que precisam de clareza estratégica. Link: /growth-room
- **UNV Partners** (R$ 30.000/ano): Board mensal + direção estratégica. Para R$ 300k-2M/mês. Link: /partners
- **UNV Mastermind** (R$ 50.000/ano): Grupo exclusivo de empresários elite. Para R$ 1M+/mês. Link: /mastermind

**SERVIÇOS ESPECIALIZADOS:**
- **UNV Finance** (R$ 3.000/mês): BPO financeiro e controladoria. Link: /finance
- **UNV People** (R$ 2.500-6.000/mês): Gestão de pessoas e recrutamento. Link: /people
- **UNV Safe** (R$ 3.000/mês): Assessoria jurídica preventiva. Link: /safe
- **UNV Leadership** (R$ 10.000/ano): Desenvolvimento de líderes intermediários. Link: /leadership
- **UNV Sales Force** (R$ 6.000/mês + comissão): Time de vendas terceirizado. Link: /sales-force
- **UNV Fractional CRO** (R$ 4.000/mês + comissão): Diretor comercial fracionado. Link: /fractional-cro
- **UNV Le Désir** (R$ 2.000/mês): Experiências premium para networking. Link: /le-desir
- **A.I. Sales System** (R$ 297-9.997/mês): Automação comercial com IA. Link: /ai-sales-system
- **UNV Execution Partnership** (R$ 40.000/3 meses): Imersão executiva intensiva. Para R$ 500k+/mês. Link: /execution-partnership

### 4. LÓGICA DE RECOMENDAÇÃO:
Baseie-se nos dados do cliente para recomendar:

| Situação do Cliente | Serviço Recomendado |
|---------------------|---------------------|
| Sem processo comercial estruturado | UNV Core |
| Falta disciplina/consistência | UNV Control |
| Time comercial precisa de treinamento | UNV Sales Acceleration ou Sales Ops |
| Poucos leads/demanda baixa | UNV Ads |
| Sem presença digital | UNV Social |
| KR off-track em vendas/comercial | UNV Sales Acceleration |
| KR off-track em liderança/time | UNV Leadership ou People |
| KR off-track em finanças | UNV Finance |
| Precisa de clareza estratégica | UNV Growth Room |
| Solidão do topo/decisões importantes | UNV Partners ou Mastermind |
| Problemas jurídicos/contratos | UNV Safe |
| Time de vendas insuficiente | UNV Sales Force |
| Precisa de direção comercial senior | UNV Fractional CRO |
| Quer automatizar processos | A.I. Sales System |
| Empresa grande (R$ 500k+) com problemas complexos | UNV Execution Partnership |

### 5. ESTRUTURA DE RESPOSTA:

1. **Diagnóstico** (1-2 frases baseadas nos dados)
2. **Ação Recomendada** (O QUE fazer - específico e executável)
3. **Justificativa** (POR QUE fazer - baseado em dados ou best practices)
4. **Próximo Passo** (pergunta ou ação imediata)
5. **Serviço UNV Recomendado** (sempre incluir no formato especificado)

### 6. REGRAS GERAIS:
- Seja objetiva, prática e orientada a ação
- Faça perguntas abertas e uma por vez
- Use os dados do planejamento para personalizar respostas
- Nunca invente números - use apenas dados reais do sistema
- Quando identificar risco (KR off track, sem check-in), seja proativa
- Tom consultivo, não de vendas agressivas
- Responda sempre em português brasileiro

Modos:
- Modo Planejamento: orientar passo a passo no wizard de planejamento estratégico (OKRs, North Star, Iniciativas, Rocks)
- Modo Execução: revisar check-ins, identificar gargalos e propor ajustes com ações específicas`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, companyName, userName, planningData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from planning data
    let dataContext = "";
    
    if (planningData) {
      const { plan, northStar, objectives, keyResults, rocks, checkins } = planningData;
      
      if (plan) {
        dataContext += `\n## Plano Estratégico ${plan.year} (v${plan.version})
- Status: ${plan.status}
- Tema do Ano: ${plan.theme || "Não definido"}
- Visão: ${plan.vision || "Não definida"}
- Etapa Atual: ${plan.current_step}/7
`;
        if (plan.context_data) {
          const ctx = plan.context_data;
          if (ctx.segment) dataContext += `- Segmento: ${ctx.segment}\n`;
          if (ctx.revenue) dataContext += `- Faturamento: ${ctx.revenue}\n`;
          if (ctx.teamSize) dataContext += `- Tamanho do Time: ${ctx.teamSize}\n`;
          if (ctx.challenges) dataContext += `- Desafios: ${ctx.challenges}\n`;
          if (ctx.lastYearRevenue) dataContext += `- Faturamento Ano Passado: ${ctx.lastYearRevenue}\n`;
          if (ctx.nextYearGoal) dataContext += `- Meta Próximo Ano: ${ctx.nextYearGoal}\n`;
        }
      }
      
      if (northStar) {
        dataContext += `\n## North Star Metric
- Métrica: ${northStar.name}
- Definição: ${northStar.definition || "Não definida"}
- Meta Anual: ${northStar.annual_target || "Não definida"} ${northStar.unit || ""}
`;
      }
      
      if (objectives && objectives.length > 0) {
        dataContext += `\n## OKRs (${objectives.length} objetivos)\n`;
        objectives.forEach((obj: any, i: number) => {
          dataContext += `\n### Objetivo ${i + 1}: ${obj.title}
- Prioridade: ${obj.priority}
- Descrição: ${obj.description || "Sem descrição"}
`;
          const objKRs = keyResults?.filter((kr: any) => kr.objective_id === obj.id) || [];
          if (objKRs.length > 0) {
            dataContext += `Key Results:\n`;
            objKRs.forEach((kr: any) => {
              const progress = kr.target > 0 ? Math.round((kr.current_value / kr.target) * 100) : 0;
              dataContext += `  - ${kr.title}: ${kr.current_value}/${kr.target} ${kr.unit || ""} (${progress}%) - Status: ${kr.status}\n`;
              
              // Add recent checkins for this KR
              const krCheckins = checkins?.filter((c: any) => c.key_result_id === kr.id)?.slice(0, 3) || [];
              if (krCheckins.length > 0) {
                dataContext += `    Check-ins recentes:\n`;
                krCheckins.forEach((c: any) => {
                  dataContext += `      - ${c.week_ref}: ${c.current_value} (${c.status}) ${c.comment ? `- "${c.comment}"` : ""}\n`;
                });
              }
            });
          }
        });
      }
      
      if (rocks && rocks.length > 0) {
        dataContext += `\n## Rocks Trimestrais (${rocks.length} rocks)\n`;
        const quarters = [1, 2, 3, 4];
        quarters.forEach(q => {
          const qRocks = rocks.filter((r: any) => r.quarter === q);
          if (qRocks.length > 0) {
            dataContext += `\nQ${q}:\n`;
            qRocks.forEach((rock: any) => {
              dataContext += `- ${rock.title} (${rock.status}): ${rock.description || ""} - Meta: ${rock.target || "Não definida"}\n`;
            });
          }
        });
      }
    }

    const contextPrompt = `
## Contexto Atual
- Empresa: ${companyName || "Não informado"}
- Usuário: ${userName || "Não informado"}
- Data: ${new Date().toLocaleDateString("pt-BR")}
${dataContext || "\n(Nenhum dado de planejamento encontrado ainda)"}
`;

    console.log("Sending context to AI:", contextPrompt.substring(0, 500) + "...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error("AI gateway error:", status, await response.text());
      
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Portal AI Coach error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
