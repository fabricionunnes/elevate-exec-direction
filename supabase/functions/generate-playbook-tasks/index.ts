import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Playbook completo da UNV para geração de tarefas
const PLAYBOOK_CONTENT = `
# PLAYBOOK DA UNIVERSIDADE NACIONAL DE VENDAS

## PILAR 1: ACELERAÇÃO E FUNDAÇÃO – PRIMEIROS 30 DIAS

### 1. Dashboard com Indicadores-Chave
- Diagnóstico do cenário atual de CRM
- Definição dos 3-5 KPIs essenciais (Taxa de Conversão, Velocidade do Ciclo, Valor Médio, Taxa de Atividades)
- Configuração de pipelines de vendas
- Treinamento da equipe no CRM
- Validação e ajustes finais

### 2. Liberação do Dashboard
- Revisão dos KPIs definidos
- Seleção de ferramenta de dashboard (Looker Studio, Power BI, etc)
- Conexão de fontes de dados
- Criação de visualizadores e gráficos
- Treinamento e lançamento

### 3. Levantamento de Dados: CAC, Conversão, Leads, Churn, Faturamento
- Identificação das fontes de dados
- Definição do período de análise
- Coleta de dados brutos (faturamento, leads, conversão, custos, churn)
- Consolidação e limpeza dos dados
- Cálculo das métricas e validação

### 4. Mapeamento de Metas Diárias, Semanais e Mensais
- Alinhamento de metas anuais/trimestrais
- Desdobramento mensal e semanal
- Desdobramento diário com funil reverso
- Criação de ferramenta de acompanhamento
- Comunicação e alinhamento com equipe

### 5. Criação de Endomarketing para Equipe Comercial
- Diagnóstico da comunicação interna atual
- Definição de objetivos do endomarketing
- Identificação de canais de comunicação
- Desenvolvimento de conteúdo piloto (Vendedor da Semana, Dicas Rápidas)
- Cronograma de conteúdo e lançamento

### 6. Plano de Recuperação de Leads
- Segmentação dos leads inativos
- Definição de canais e abordagens por segmento
- Criação de templates de e-mails e scripts
- Automação de fluxos de recuperação
- Treinamento da equipe

### 7. Calendário de Campanhas Sazonais
- Pesquisa de datas relevantes
- Análise de desempenho histórico
- Brainstorming de temas e ofertas
- Criação do calendário anual
- Alinhamento com marketing e vendas

### 8. Implementação de Cadências de Contato
- Revisão do funil e atividades
- Identificação de pontos de contato chave
- Definição de canais e mensagens
- Criação de templates de cadência
- Configuração e treinamento

### 9. Pesquisa de Perfil Comportamental (DISC)
- Escolha da ferramenta de avaliação
- Aplicação do teste na equipe
- Análise individual dos resultados
- Sessões de feedback individuais
- Workshop de integração de perfis

### 10. Criação de Playbook de Vendas (versão inicial)
- Definição de estrutura do playbook
- Documentação das etapas do funil
- Scripts de abordagem e objeções
- Critérios de qualificação
- Validação e treinamento

### 11. Agendamento do Planejamento de Trilha de Desenvolvimento
- Reunião de kick-off com liderança
- Identificação das funções-chave
- Definição de escopo e cronograma
- Preparação de material de entrevista
- Agendamento das reuniões

### 12. Implantação de Líder de Vendas Interno
- Definição do perfil do líder
- Identificação de candidatos internos
- Processo de seleção/promoção
- Plano de transição e treinamento
- Apresentação à equipe e mentoria

### 13. Diagnóstico de Tráfego Pago
- Acesso às plataformas de anúncios
- Coleta e análise de dados
- Identificação de oportunidades e problemas
- Benchmarking do setor
- Relatório com recomendações

### 14. Agendamento de Reestruturação de Plano de Carreira e Comissionamento
- Reunião de alinhamento inicial
- Definição de stakeholders
- Coleta de dados atuais
- Pesquisa de benchmarking
- Cronograma de trabalho

### 15. Agendamento de Reunião sobre Posicionamento em Redes Sociais
- Definição dos participantes
- Preparação do pré-briefing
- Coleta de materiais existentes
- Pesquisa de concorrentes
- Elaboração da pauta

## PILAR 2: JORNADA DE CRESCIMENTO CONTÍNUO (12 MESES)

### 1. Reuniões de Check-in Recorrentes (Semanais/Quinzenais)
- Preparação de pauta
- Revisão de progresso e métricas
- Identificação de desafios
- Definição de próximos passos
- Documentação de ata

### 2. Reuniões de Resultados e Alinhamento (Mensais/Trimestrais)
- Preparação de relatório de performance
- Análise de resultados vs metas
- Identificação de tendências
- Ajuste de estratégias
- Definição de novas metas

### 3. Atualizações de Dashboard
- Coleta de feedback de uso
- Identificação de novos indicadores
- Implementação de melhorias
- Comunicação das atualizações

### 4. Implementação Contínua do CRM
- Monitoramento de uso e qualidade dos dados
- Identificação de gargalos
- Proposição de melhorias e automações
- Treinamento de reforço

### 5. Posicionamento Estratégico em Redes Sociais (Contínuo)
- Análise de desempenho dos posts
- Monitoramento de tendências
- Proposição de ajustes
- Validação com cliente

### 6. Calendário de Campanhas Sazonais (Contínuo)
- Revisão do calendário anterior
- Pesquisa de novas oportunidades
- Atualização do calendário

### 7. Trilha de Desenvolvimento por Função (Contínuo)
- Mapeamento de competências
- Identificação de gaps
- Construção das trilhas
- Acompanhamento de progresso

### 8. Plano de Comissão Variável Escalonado
- Análise do plano atual
- Desenho do modelo escalonado
- Simulação de impacto
- Documentação de regras

### 9. Execução do Plano de Carreira e Comissionamento
- Comunicação do plano
- Sessão de Q&A
- Materiais de apoio
- Treinamento para líderes

### 10. Pesquisa de Satisfação NPS/CSAT
- Definição de métrica e frequência
- Criação de pesquisa
- Análise de resultados
- Plano de ação

### 11. Criação de Área de CS (Customer Success)
- Definição de escopo e objetivos
- Criação de processos
- Treinamento da equipe
- Implementação de ferramentas

### 12. Sessões de Role-Playing e Coaching
- Planejamento de cenários
- Execução das sessões
- Feedback e documentação

### 13. Reuniões Individuais (1:1) com Vendedores
- Preparação de pauta individual
- Execução da reunião
- Definição de plano de ação

### 14. Auditoria de CRM
- Revisão de qualidade dos dados
- Análise de aderência
- Identificação de problemas
- Feedback e correções

### 15. Programa de Indicação
- Definição de público-alvo
- Definição de incentivos
- Desenho do processo
- Materiais de divulgação

### 16. Treinamento de Vendas Avançado
- Identificação de necessidades
- Desenvolvimento de conteúdo
- Execução do treinamento
- Follow-up e prática

### 17. Coleta de Resultados e Alinhamento de Metas (Recorrente)
- Preparação de dados
- Análise de desempenho
- Reunião de alinhamento
- Documentação

### 18. Funil de Social Selling
- Otimização de perfis
- Treinamento em pesquisa
- Templates de mensagens
- Rotina de social selling

### 19. Fluxo de Pós-Venda com Upgrade e Cross-Sell
- Mapeamento da jornada pós-venda
- Identificação de oportunidades
- Desenho do fluxo de comunicação
- Treinamento da equipe

### 20. Atualização do Playbook com Melhorias de Campo
- Canal de feedback
- Reuniões de melhores práticas
- Análise e incorporação
- Versionamento

### 21. Reuniões Estratégicas com Liderança
- Pauta estratégica
- Revisão de resultados
- Planejamento de longo prazo
- Alinhamento executivo
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, companyId, context } = await req.json();

    console.log("Generating playbook tasks for project:", projectId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch project and company context
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("*")
      .eq("id", projectId)
      .single();

    let company = null;
    if (companyId) {
      const { data: companyData } = await supabase
        .from("onboarding_companies")
        .select("*")
        .eq("id", companyId)
        .single();
      company = companyData;
    }

    // Fetch existing tasks to avoid duplicates
    const { data: existingTasks } = await supabase
      .from("onboarding_tasks")
      .select("title")
      .eq("project_id", projectId);

    const existingTaskTitles = existingTasks?.map(t => t.title.toLowerCase()) || [];

    // Build context for AI
    const companyContext = company ? `
## CONTEXTO DA EMPRESA
- Nome: ${company.name}
- Segmento: ${company.segment || "Não informado"}
- Website: ${company.website || "N/A"}

### Descrição da Empresa:
${company.company_description || "Não informado"}

### Principais Desafios:
${company.main_challenges || "Não informado"}

### Metas de Curto Prazo:
${company.goals_short_term || "Não informado"}

### Metas de Longo Prazo:
${company.goals_long_term || "Não informado"}

### Público-Alvo:
${company.target_audience || "Não informado"}

### Concorrentes:
${company.competitors || "Não informado"}
` : "";

    const projectContext = project ? `
## CONTEXTO DO PROJETO
- Produto: ${project.product_name}
- Status: ${project.status}
- Complexidade: ${project.project_complexity || "Não avaliado"}
- Bloqueios Atuais: ${project.current_blockers || "Nenhum"}
- Feedback do Cliente: ${project.client_feedback || "N/A"}
` : "";

    const additionalContext = context ? `
## CONTEXTO ADICIONAL FORNECIDO:
${context}
` : "";

    const systemPrompt = `Você é um consultor especialista da Universidade Nacional de Vendas (UNV).
Sua tarefa é analisar o contexto do projeto e da empresa, e sugerir tarefas ESPECÍFICAS e PERSONALIZADAS baseadas no Playbook da UNV.

${PLAYBOOK_CONTENT}

${companyContext}

${projectContext}

${additionalContext}

## TAREFAS JÁ EXISTENTES NO PROJETO (não repetir):
${existingTaskTitles.join(", ") || "Nenhuma"}

## INSTRUÇÕES:
1. Analise cuidadosamente o contexto da empresa e do projeto
2. Identifique 5-10 ações do Playbook que são MAIS RELEVANTES para este cliente específico
3. Personalize cada tarefa para o contexto real da empresa
4. Evite tarefas genéricas - seja específico com base nas informações do cliente
5. Priorize tarefas que resolvam os desafios mencionados
6. NÃO repita tarefas que já existem no projeto

## FORMATO DE RESPOSTA:
Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem texto adicional):
{
  "tasks": [
    {
      "title": "Título da tarefa (máx 80 caracteres)",
      "description": "Descrição detalhada e personalizada da tarefa",
      "phase": "Nome da fase do playbook",
      "priority": "high" | "medium" | "low",
      "responsible_role": "consultant" | "cs" | "client",
      "estimated_days": número de dias estimados
    }
  ]
}

IMPORTANTE: 
- Personalize os títulos e descrições com o nome da empresa e contexto específico
- Conecte cada tarefa aos desafios e metas mencionados
- Seja prático e acionável nas descrições`;

    const userPrompt = "Gere tarefas personalizadas para este projeto com base no Playbook da UNV e no contexto fornecido.";

    console.log("Calling Lovable AI Gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponse = data.choices?.[0]?.message?.content || "";

    console.log("AI response received:", aiResponse.substring(0, 200));

    // Parse JSON response
    try {
      // Remove markdown code blocks if present
      aiResponse = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const parsed = JSON.parse(aiResponse);
      
      return new Response(
        JSON.stringify({ tasks: parsed.tasks || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: aiResponse }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error in generate-playbook-tasks:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
