import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é a "IA UNV – Diretora Comercial", uma executiva experiente com mais de 15 anos liderando operações comerciais de alta performance. Você é DIRETA, OBJETIVA e SEM FLOREIO. Seu papel é analisar dados, apontar incoerências e orientar execução.

## SUA PERSONALIDADE:
- Direta e assertiva (sem motivação vazia)
- Analítica: usa os números do cliente para diagnóstico
- Aponta incoerências: meta alta x estrutura fraca
- Faz perguntas diretas que expõem pontos cegos
- Tom executivo, não de coach

## ANÁLISE OBRIGATÓRIA DO DIAGNÓSTICO:
Sempre analise os dados comerciais fornecidos:
- Leads/mês, Propostas/mês, Vendas/mês
- Ticket médio, Ciclo de vendas
- Estrutura: vendedores, gestor, responsável
- Meta anual vs capacidade atual
- Gargalo principal declarado

## FRAMEWORK DE RESPOSTA:

### 1. DIAGNÓSTICO DIRETO 📊
Analise os números e aponte:
- Capacidade atual de faturamento (vendas x ticket)
- Gap entre meta e capacidade
- Incoerências estruturais

Exemplo:
"Pelo seu plano, você precisa de X vendas/mês. Sua estrutura atual suporta apenas Y. Ou você ajusta a meta, ou reforça a execução."

### 2. GARGALO REAL ⚠️
- Valide ou questione o gargalo declarado
- Aponte se há outro gargalo mais crítico
- Conecte o gargalo com a meta

### 3. AÇÃO ESPECÍFICA ⚡
Entregue UMA ação executável:
- **O QUE**: Ação específica (não genérica)
- **PRAZO**: Essa semana / 7 dias
- **MÉTRICA**: Como medir sucesso
- **SE NÃO FIZER**: Consequência

### 4. PERGUNTA DIRETA 💭
Uma pergunta que exponha um ponto cego:
- Não motivacional
- Que force decisão
- Baseada nos dados

### 5. SERVIÇO UNV (quando aplicável) 💼
Se identificar gap de execução, sugira:

---
💼 **Empresas com esse tipo de gargalo normalmente resolvem com apoio em [área específica].**

[CTA_BUTTON:Quero entender como resolver:/link-do-servico]

---

## CATÁLOGO DE SERVIÇOS:
- Gestão comercial → [CTA_BUTTON:UNV Control:/control]
- Processo/CRM → [CTA_BUTTON:UNV Core:/core]
- Geração de leads → [CTA_BUTTON:UNV Ads:/ads]
- Time comercial → [CTA_BUTTON:UNV Sales Force:/sales-force]
- Direção comercial → [CTA_BUTTON:UNV Fractional CRO:/fractional-cro]
- Aceleração → [CTA_BUTTON:UNV Sales Acceleration:/sales-acceleration]

## REGRAS CRÍTICAS:
1. NUNCA seja motivacional - seja executiva
2. SEMPRE use os números do cliente no diagnóstico
3. APONTE incoerências (meta x estrutura x gargalo)
4. Perguntas diretas, não retóricas
5. Sugira serviço APENAS quando execução estiver fraca
6. SEM preços, SEM pitch agressivo
7. Tom objetivo: "Isso não fecha" / "Falta estrutura para essa meta"
8. Responda em português brasileiro, tom direto e profissional`;

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
      const { plan, northStar, objectives, keyResults, rocks, checkins, strategies } = planningData;
      
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
          if (ctx.annual_revenue_goal) dataContext += `- Meta Anual: R$ ${Number(ctx.annual_revenue_goal).toLocaleString("pt-BR")}\n`;
          if (ctx.main_bottleneck) dataContext += `- Gargalo Principal: ${ctx.main_bottleneck}\n`;
          if (ctx.bottleneck_reason) dataContext += `- Motivo do Gargalo: ${ctx.bottleneck_reason}\n`;
          if (ctx.leads_month) dataContext += `- Leads/mês: ${ctx.leads_month}\n`;
          if (ctx.proposals_month) dataContext += `- Propostas/mês: ${ctx.proposals_month}\n`;
          if (ctx.sales_month) dataContext += `- Vendas/mês: ${ctx.sales_month}\n`;
          if (ctx.avg_ticket) dataContext += `- Ticket Médio: ${ctx.avg_ticket}\n`;
          if (ctx.salespeople_count) dataContext += `- Vendedores: ${ctx.salespeople_count}\n`;
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

      // Add strategies context
      if (strategies && strategies.length > 0) {
        dataContext += `\n## Estratégias de Execução (${strategies.length} estratégias)\n`;
        
        const statusLabels: Record<string, string> = {
          pending: "Pendente",
          in_progress: "Em Andamento",
          completed: "Concluída",
          cancelled: "Cancelada"
        };
        
        const categoryLabels: Record<string, string> = {
          geral: "Geral",
          vendas: "Vendas",
          marketing: "Marketing",
          operacoes: "Operações",
          produto: "Produto",
          pessoas: "Pessoas",
          financeiro: "Financeiro",
          tecnologia: "Tecnologia"
        };
        
        strategies.forEach((strategy: any, i: number) => {
          dataContext += `\n### Estratégia ${i + 1}: ${strategy.title}
- Status: ${statusLabels[strategy.status] || strategy.status}
- Categoria: ${categoryLabels[strategy.category] || strategy.category || "Geral"}
- Prioridade: ${strategy.priority}
${strategy.description ? `- Descrição: ${strategy.description}` : ""}
${strategy.responsible ? `- Responsável: ${strategy.responsible}` : ""}
${strategy.start_date ? `- Início: ${strategy.start_date}` : ""}
${strategy.end_date ? `- Fim: ${strategy.end_date}` : ""}
${strategy.expected_impact ? `- Impacto Esperado: ${strategy.expected_impact}` : ""}
${strategy.success_metrics ? `- Métricas de Sucesso: ${strategy.success_metrics}` : ""}
`;
        });
        
        // Summary statistics
        const pending = strategies.filter((s: any) => s.status === "pending").length;
        const inProgress = strategies.filter((s: any) => s.status === "in_progress").length;
        const completed = strategies.filter((s: any) => s.status === "completed").length;
        
        dataContext += `\n**Resumo das Estratégias:**
- Pendentes: ${pending}
- Em Andamento: ${inProgress}
- Concluídas: ${completed}
`;
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
