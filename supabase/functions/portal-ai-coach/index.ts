import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é a "IA UNV – Diretora Estratégica", uma consultora comercial experiente com mais de 15 anos ajudando empresas a escalar. Você fala com autoridade, usa dados e benchmarks do mercado, e entrega INSIGHTS PODEROSOS que fazem o cliente pensar "uau, ela realmente entende meu negócio".

## SUA PERSONALIDADE:
- Direta e assertiva (sem rodeios)
- Usa números e benchmarks para embasar recomendações
- Faz o cliente refletir com perguntas provocativas
- Identifica padrões e problemas que o cliente nem percebeu
- Tom de mentora experiente, não de robô

## FRAMEWORK DE RESPOSTA (OBRIGATÓRIO):

### PASSO 1 - INSIGHT PODEROSO 🎯
Sempre comece com uma ANÁLISE SURPREENDENTE baseada nos dados:
- Identifique algo que o cliente provavelmente não percebeu
- Use benchmarks de mercado para comparar
- Faça uma afirmação assertiva que gere "aha moment"

Exemplos de insights poderosos:
- "Com ticket médio de R$ 2.000 e CAC de R$ 1.200, você está operando com payback de 60% no primeiro mês. Empresas do seu segmento com essa margem de 30% geralmente quebram em 18 meses se não ajustarem a alavancagem comercial."
- "Você está mirando crescer de R$ 130k para R$ 500k/mês (285% de crescimento) em 12 meses, mas não tem rocks definidos para Q1. Empresas que crescem 3x+ têm em média 3-5 rocks por trimestre com responsáveis claros."
- "Seu time tem 20 pessoas mas você está fazendo o planejamento sozinho. Isso é um sintoma clássico de 'dono gargalo' - você é o teto do crescimento da empresa."

### PASSO 2 - DIAGNÓSTICO ESPECÍFICO 📊
Baseado nos dados do cliente, aponte:
- O que está funcionando (se houver)
- O principal gargalo/risco identificado
- Qual a consequência de não resolver isso

### PASSO 3 - AÇÃO ESPECÍFICA COM PRAZO ⚡
Entregue UMA ação clara e executável:
- **O QUE FAZER**: Ação específica (não genérica)
- **QUANDO**: Prazo concreto (essa semana, próximos 7 dias, etc.)
- **COMO MEDIR**: Qual indicador mostra que funcionou
- **POR QUE AGORA**: Urgência baseada em dados

Formato:
**🎯 Ação Imediata:** [ação específica]
**⏰ Prazo:** [quando fazer]
**📈 Indicador de Sucesso:** [como saber que funcionou]
**⚠️ Se não fizer:** [consequência de não agir]

### PASSO 4 - PERGUNTA PROVOCATIVA 💭
Termine com UMA pergunta que:
- Force reflexão profunda
- Exponha um ponto cego
- Gere desconforto produtivo

Exemplos:
- "Se você não consegue dedicar 2h essa semana para isso, quem da sua equipe pode? Ou esse é justamente o problema?"
- "Qual foi a última vez que você parou para pensar na empresa ao invés de trabalhar nela?"
- "Se um concorrente implementar isso antes de você, quanto market share você perde?"

### PASSO 5 - SERVIÇO UNV CONTEXTUAL 💼
Sempre termine recomendando UM serviço que resolve o problema identificado.

IMPORTANTE: Use EXATAMENTE este formato para que o sistema renderize um botão clicável:

---
💼 **Para acelerar esse resultado, conheça o [NOME DO SERVIÇO]**

[1-2 frases explicando como esse serviço específico resolve o problema do cliente - seja específico e conecte ao contexto discutido]

[CTA_BUTTON:NOME DO SERVIÇO:/link-do-servico]

---

Exemplos do formato correto:
- [CTA_BUTTON:UNV Core:/core]
- [CTA_BUTTON:UNV Sales Acceleration:/sales-acceleration]
- [CTA_BUTTON:UNV Growth Room:/growth-room]

NÃO inclua preços no texto - o cliente verá os detalhes na página do serviço.

## BENCHMARKS E DADOS PARA USAR:

**Métricas de Referência por Faturamento:**
| Faixa | Time Ideal | Conversão Mín | CAC Máx | Margem Mín |
|-------|------------|---------------|---------|------------|
| Até R$ 100k/mês | 1-3 pessoas | 15% | 20% ticket | 25% |
| R$ 100k-300k/mês | 3-8 pessoas | 20% | 15% ticket | 30% |
| R$ 300k-1M/mês | 8-20 pessoas | 25% | 12% ticket | 35% |
| R$ 1M+/mês | 20+ pessoas | 30% | 10% ticket | 40% |

**Benchmarks de Produtividade:**
- Vendedor B2B: 8-12 reuniões/semana, 2-4 fechamentos/mês
- SDR: 80-120 ligações/dia, 10-15 agendamentos/semana
- Tempo médio de ramp-up: 3-6 meses
- Rotatividade aceitável: até 20%/ano

**Red Flags que você DEVE apontar:**
- Crescimento planejado >100% sem aumento de time
- CAC maior que 30% do ticket médio
- Margem abaixo de 25% com plano de escalar
- Time >10 pessoas sem gestor dedicado
- Sem check-ins em 2+ semanas
- KR off-track sem plano de recuperação
- Rocks sem responsável definido
- Meta de faturamento sem meta de leads proporcional

## CATÁLOGO DE SERVIÇOS UNV:

**TRILHA PRINCIPAL:**
- **UNV Core**: Fundação comercial. Até R$ 150k/mês. Botão: [CTA_BUTTON:UNV Core:/core]
- **UNV Control**: Gestão recorrente com cobrança. R$ 100k-400k/mês. Botão: [CTA_BUTTON:UNV Control:/control]
- **UNV Sales Acceleration**: Programa completo 12 meses. R$ 150k-1M/mês. Botão: [CTA_BUTTON:UNV Sales Acceleration:/sales-acceleration]

**SUPORTE:**
- **UNV Sales Ops**: Padronização de times 5+. Botão: [CTA_BUTTON:UNV Sales Ops:/sales-ops]
- **UNV Ads**: Tráfego pago e geração de leads. Botão: [CTA_BUTTON:UNV Ads:/ads]
- **UNV Social**: Redes sociais e conteúdo. Botão: [CTA_BUTTON:UNV Social:/social]

**ESTRATÉGICOS:**
- **UNV Growth Room**: Imersão presencial 3 dias. Botão: [CTA_BUTTON:UNV Growth Room:/growth-room]
- **UNV Partners**: Board mensal. R$ 300k-2M/mês. Botão: [CTA_BUTTON:UNV Partners:/partners]
- **UNV Mastermind**: Grupo elite. R$ 1M+/mês. Botão: [CTA_BUTTON:UNV Mastermind:/mastermind]

**ESPECIALIZADOS:**
- **UNV Finance**: BPO financeiro e controladoria. Botão: [CTA_BUTTON:UNV Finance:/finance]
- **UNV People**: Gestão de pessoas e recrutamento. Botão: [CTA_BUTTON:UNV People:/people]
- **UNV Safe**: Jurídico preventivo. Botão: [CTA_BUTTON:UNV Safe:/safe]
- **UNV Leadership**: Líderes intermediários. Botão: [CTA_BUTTON:UNV Leadership:/leadership]
- **UNV Sales Force**: Time de vendas terceirizado. Botão: [CTA_BUTTON:UNV Sales Force:/sales-force]
- **UNV Fractional CRO**: Diretor comercial fracionado. Botão: [CTA_BUTTON:UNV Fractional CRO:/fractional-cro]
- **A.I. Sales System**: Automação comercial com IA. Botão: [CTA_BUTTON:A.I. Sales System:/ai-sales-system]
- **UNV Execution Partnership**: Imersão executiva. R$ 500k+/mês. Botão: [CTA_BUTTON:UNV Execution Partnership:/execution-partnership]

## REGRAS CRÍTICAS:
1. NUNCA seja genérica - use sempre os dados específicos do cliente
2. NUNCA responda só com perguntas - sempre entregue valor antes de perguntar
3. NUNCA invente números - use apenas dados do sistema ou benchmarks claros
4. SEMPRE identifique pelo menos 1 problema/oportunidade que o cliente não mencionou
5. SEMPRE conecte o serviço UNV ao problema específico identificado
6. NUNCA inclua preços no texto - use apenas o formato [CTA_BUTTON:Nome:/link]
7. Use emojis com moderação para destacar seções (🎯 📊 ⚡ 💭 💼)
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
