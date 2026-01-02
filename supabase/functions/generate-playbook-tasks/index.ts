import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento completo de deliverables e entregas por produto
const PRODUCT_DELIVERABLES: Record<string, {
  name: string;
  tagline: string;
  deliverables: string[];
  problemsSolved: { problem: string; solution: string; result: string }[];
  keyBenefits: string[];
  timeToResults: string;
  phases: { name: string; description: string; tasks: string[] }[];
}> = {
  core: {
    name: "UNV Core",
    tagline: "Fundação Comercial Inicial",
    deliverables: [
      "Diagnóstico comercial direcional",
      "Estruturação básica de funil de vendas",
      "Scripts essenciais de abordagem",
      "Definição de metas básicas",
      "UNV AI Advisor nível básico",
      "Cobrança básica de execução"
    ],
    problemsSolved: [
      { problem: "Vendas sem método", solution: "Estruturação de funil com etapas claras", result: "Clareza de onde cada lead está" },
      { problem: "Não sabe o que falar", solution: "Scripts de abordagem prontos", result: "Comunicação padronizada" },
      { problem: "Sem metas claras", solution: "Definição de metas básicas", result: "Clareza de onde precisa chegar" },
      { problem: "Vendas dependem do dono", solution: "Processo documentado", result: "Base para delegar" }
    ],
    keyBenefits: ["Sair do amadorismo", "Processo replicável", "Medir resultados", "Base para escalar"],
    timeToResults: "30-60 dias",
    phases: [
      {
        name: "Diagnóstico",
        description: "Análise inicial da operação comercial",
        tasks: [
          "Realizar diagnóstico comercial inicial - mapear situação atual de vendas",
          "Identificar principais gargalos e oportunidades de melhoria",
          "Definir perfil do cliente ideal (ICP) baseado em dados",
          "Mapear jornada de compra atual do cliente"
        ]
      },
      {
        name: "Estruturação",
        description: "Montagem da estrutura básica de vendas",
        tasks: [
          "Desenhar funil de vendas com etapas claras e mensuráveis",
          "Definir critérios de qualificação de leads (BANT ou similar)",
          "Estruturar CRM com pipelines adequados ao funil",
          "Criar campos obrigatórios e automações básicas no CRM"
        ]
      },
      {
        name: "Scripts e Processos",
        description: "Criação de material de vendas",
        tasks: [
          "Desenvolver script de abordagem inicial (cold call/WhatsApp)",
          "Criar script de qualificação de leads",
          "Desenvolver roteiro de apresentação comercial",
          "Criar matriz de objeções com respostas prontas",
          "Desenvolver script de fechamento"
        ]
      },
      {
        name: "Metas e Métricas",
        description: "Definição de indicadores de performance",
        tasks: [
          "Definir metas mensais de vendas baseadas em capacidade",
          "Estabelecer KPIs essenciais (leads, conversão, ticket médio)",
          "Criar dashboard simples de acompanhamento",
          "Estabelecer ritual de acompanhamento semanal de metas"
        ]
      },
      {
        name: "Ativação",
        description: "Colocar em prática e acompanhar",
        tasks: [
          "Treinar equipe nos scripts e processos criados",
          "Configurar UNV AI Advisor para suporte básico",
          "Iniciar rotina de cobrança semanal de execução",
          "Realizar primeiro check-in de resultados (30 dias)"
        ]
      }
    ]
  },
  control: {
    name: "UNV Control",
    tagline: "Direção Comercial Recorrente",
    deliverables: [
      "Direção estratégica mensal",
      "Acompanhamento via AI semanal",
      "Templates e scripts prontos",
      "Cobrança de execução contínua",
      "Acesso à comunidade UNV",
      "UNV AI Advisor nível execução"
    ],
    problemsSolved: [
      { problem: "Vendas boas um mês, péssimas no outro", solution: "Direção mensal + cobrança contínua", result: "Previsibilidade de receita" },
      { problem: "Não consegue manter disciplina", solution: "Acompanhamento semanal via AI", result: "Impossível perder ritmo" },
      { problem: "Sem rede de empresários", solution: "Comunidade de empresários", result: "Benchmarks e apoio" },
      { problem: "Reinventando a roda", solution: "Templates prontos", result: "Só executa o que funciona" }
    ],
    keyBenefits: ["Consistência de execução", "Cobrança de resultados", "Comunidade", "Previsibilidade"],
    timeToResults: "A partir do 2º mês",
    phases: [
      {
        name: "Onboarding",
        description: "Configuração inicial do acompanhamento",
        tasks: [
          "Realizar diagnóstico de situação atual de vendas",
          "Definir metas do trimestre com base em histórico",
          "Configurar UNV AI Advisor para acompanhamento semanal",
          "Integrar cliente à comunidade UNV"
        ]
      },
      {
        name: "Direção Mensal",
        description: "Reuniões estratégicas mensais",
        tasks: [
          "Realizar reunião de direção estratégica mensal",
          "Analisar resultados do mês anterior vs metas",
          "Definir prioridades e ajustes para o próximo mês",
          "Revisar e atualizar templates e scripts conforme necessidade"
        ]
      },
      {
        name: "Acompanhamento Semanal",
        description: "Check-ins semanais via AI",
        tasks: [
          "Configurar check-ins semanais via UNV AI Advisor",
          "Responder perguntas de execução via AI",
          "Receber cobrança de atividades pendentes",
          "Documentar aprendizados semanais"
        ]
      },
      {
        name: "Execução Contínua",
        description: "Manutenção da disciplina comercial",
        tasks: [
          "Aplicar templates de prospecção enviados",
          "Executar cadências de follow-up recomendadas",
          "Participar de eventos da comunidade UNV",
          "Reportar resultados mensais para análise"
        ]
      }
    ]
  },
  "sales-acceleration": {
    name: "UNV Sales Acceleration",
    tagline: "Aceleração Comercial Completa",
    deliverables: [
      "Diagnóstico comercial completo",
      "Direção estratégica mensal + semanal",
      "Treinamento do time em 5 fases",
      "Estruturação completa de funil",
      "Scripts por fase do funil",
      "Metas e KPIs completos",
      "Avaliações por vendedor",
      "UNV AI Advisor nível máximo",
      "1 convite/ano Experiência Mansão"
    ],
    problemsSolved: [
      { problem: "Time sem padronização", solution: "Treinamento em 5 fases", result: "Todo mundo no mesmo padrão" },
      { problem: "Dono é o melhor vendedor", solution: "Estruturação + avaliações individuais", result: "Time vende igual ou melhor" },
      { problem: "Não sabe quem performa", solution: "Metas e KPIs + avaliações", result: "Clareza de quem manter" },
      { problem: "Crescimento travado", solution: "Direção mensal + semanal", result: "Crescimento de 30-100%" }
    ],
    keyBenefits: ["Transformação em 12 meses", "Time treinado", "Métricas claras", "Dono livre"],
    timeToResults: "Quick wins em 30 dias, transformação em 6-12 meses",
    phases: [
      {
        name: "Diagnóstico Completo",
        description: "Análise profunda da operação comercial",
        tasks: [
          "Realizar diagnóstico comercial completo (processos, pessoas, métricas)",
          "Mapear pontos fortes e fracos de cada vendedor",
          "Identificar gaps de processo e oportunidades",
          "Definir baseline de métricas para acompanhamento",
          "Elaborar plano de transformação de 12 meses"
        ]
      },
      {
        name: "Estruturação de Funil",
        description: "Redesenho completo do funil de vendas",
        tasks: [
          "Redesenhar funil de vendas com etapas detalhadas",
          "Definir critérios de passagem entre etapas",
          "Configurar CRM com novo funil e automações",
          "Criar playbook de vendas por etapa do funil",
          "Estabelecer SLAs entre etapas"
        ]
      },
      {
        name: "Treinamento Fase 1-2",
        description: "Fundamentos e Prospecção",
        tasks: [
          "Treinar time em Fundamentos de Vendas Consultivas",
          "Treinar time em Técnicas de Prospecção e Abordagem",
          "Desenvolver scripts personalizados de prospecção",
          "Aplicar roleplay de prospecção com feedback",
          "Avaliar absorção e gaps individuais"
        ]
      },
      {
        name: "Treinamento Fase 3-4",
        description: "Qualificação e Apresentação",
        tasks: [
          "Treinar time em Qualificação BANT/MEDDIC",
          "Treinar time em Apresentação e Demonstração",
          "Desenvolver pitch deck e roteiro de demo",
          "Aplicar roleplay de qualificação e demo",
          "Avaliar evolução individual"
        ]
      },
      {
        name: "Treinamento Fase 5",
        description: "Negociação e Fechamento",
        tasks: [
          "Treinar time em Negociação e Fechamento",
          "Desenvolver matriz de objeções avançada",
          "Treinar técnicas de fechamento",
          "Aplicar roleplay de negociação complexa",
          "Certificar vendedores aprovados"
        ]
      },
      {
        name: "Metas e KPIs",
        description: "Sistema de metas e acompanhamento",
        tasks: [
          "Definir metas individuais e de time",
          "Estabelecer KPIs por vendedor e por etapa do funil",
          "Criar dashboard de acompanhamento em tempo real",
          "Implementar ritual de daily/weekly de resultados",
          "Configurar alertas de performance"
        ]
      },
      {
        name: "Avaliações e Direção",
        description: "Acompanhamento contínuo",
        tasks: [
          "Realizar avaliação trimestral de cada vendedor",
          "Conduzir reunião de direção estratégica semanal",
          "Conduzir reunião de direção mensal com liderança",
          "Ajustar plano conforme resultados e feedbacks",
          "Preparar convite para Experiência Mansão"
        ]
      }
    ]
  },
  "growth-room": {
    name: "UNV Growth Room",
    tagline: "Imersão Presencial Estratégica",
    deliverables: [
      "3 dias de imersão presencial",
      "Diagnóstico pré-imersão",
      "Direção estratégica intensiva",
      "Estruturação completa de funil",
      "Scripts e roteiros",
      "Plano de 90 dias",
      "Acompanhamento pós-imersão",
      "Treinamento intensivo"
    ],
    problemsSolved: [
      { problem: "Cabeça no operacional", solution: "3 dias focado em estratégia", result: "Clareza do que fazer em 90 dias" },
      { problem: "Não sabe por onde começar", solution: "Diagnóstico + estruturação", result: "Funil pronto, prioridades definidas" },
      { problem: "Decide sozinho", solution: "Direção intensiva", result: "Decisões mais seguras" },
      { problem: "Não implementa", solution: "Plano concreto + acompanhamento", result: "Implementação garantida" }
    ],
    keyBenefits: ["Clareza em 3 dias", "Plano de 90 dias", "Saída do operacional", "Implementação acompanhada"],
    timeToResults: "Clareza imediata, resultados em 90 dias",
    phases: [
      {
        name: "Pré-Imersão",
        description: "Preparação antes dos 3 dias",
        tasks: [
          "Enviar formulário de diagnóstico pré-imersão",
          "Coletar dados de vendas, métricas e processos atuais",
          "Analisar respostas e preparar material personalizado",
          "Agendar imersão e confirmar logística",
          "Enviar orientações de preparação ao cliente"
        ]
      },
      {
        name: "Dia 1 - Diagnóstico",
        description: "Primeiro dia da imersão",
        tasks: [
          "Conduzir sessão de alinhamento e expectativas",
          "Realizar diagnóstico profundo da operação",
          "Mapear funil atual e identificar gargalos",
          "Definir ICP e proposta de valor refinada",
          "Encerrar dia 1 com insights principais"
        ]
      },
      {
        name: "Dia 2 - Estruturação",
        description: "Segundo dia da imersão",
        tasks: [
          "Redesenhar funil de vendas completo",
          "Criar scripts de abordagem e qualificação",
          "Desenvolver roteiro de apresentação comercial",
          "Estruturar matriz de objeções",
          "Definir métricas e KPIs essenciais"
        ]
      },
      {
        name: "Dia 3 - Plano de Ação",
        description: "Terceiro dia da imersão",
        tasks: [
          "Elaborar plano de 90 dias com marcos semanais",
          "Definir prioridades e quick wins",
          "Treinar conceitos-chave para equipe",
          "Apresentar plano final ao CEO/dono",
          "Definir cronograma de acompanhamento pós-imersão"
        ]
      },
      {
        name: "Pós-Imersão",
        description: "Acompanhamento após a imersão",
        tasks: [
          "Realizar check-in de 15 dias pós-imersão",
          "Realizar check-in de 30 dias pós-imersão",
          "Realizar check-in de 60 dias pós-imersão",
          "Realizar check-in final de 90 dias",
          "Avaliar resultados e próximos passos"
        ]
      }
    ]
  },
  partners: {
    name: "UNV Partners",
    tagline: "Direção Estratégica & Board Externo",
    deliverables: [
      "Board mensal de direção",
      "Acompanhamento semanal",
      "Cobrança de execução direta",
      "Direção individual recorrente",
      "Comunidade elite",
      "UNV AI Advisor estratégico",
      "Eventos exclusivos",
      "Experiência Mansão recorrente",
      "Benchmark com pares"
    ],
    problemsSolved: [
      { problem: "Decisões sozinho", solution: "Board mensal + direção individual", result: "Decisões mais assertivas" },
      { problem: "Solidão do topo", solution: "Comunidade elite + Mansão", result: "Rede de confiança" },
      { problem: "Ninguém te cobra", solution: "Cobrança direta + acompanhamento semanal", result: "Accountability real" },
      { problem: "Não sabe próximo passo", solution: "Direção estratégica recorrente", result: "Clareza de prioridades" }
    ],
    keyBenefits: ["Parceria estratégica", "Rede elite", "Accountability", "Mansão recorrente"],
    timeToResults: "Impacto imediato, resultados em 3-6 meses",
    phases: [
      {
        name: "Onboarding Partners",
        description: "Integração ao programa",
        tasks: [
          "Realizar diagnóstico estratégico inicial",
          "Definir metas anuais e trimestrais",
          "Integrar à comunidade elite Partners",
          "Configurar UNV AI Advisor estratégico",
          "Agendar primeiro board de direção"
        ]
      },
      {
        name: "Board Mensal",
        description: "Reuniões de direção mensal",
        tasks: [
          "Realizar board mensal de direção",
          "Revisar resultados do mês anterior",
          "Definir prioridades estratégicas do mês",
          "Tomar decisões estratégicas importantes",
          "Documentar ata e compromissos"
        ]
      },
      {
        name: "Acompanhamento Semanal",
        description: "Check-ins semanais",
        tasks: [
          "Realizar check-in semanal de execução",
          "Cobrar pendências e compromissos",
          "Resolver dúvidas estratégicas",
          "Ajustar rota conforme necessidade"
        ]
      },
      {
        name: "Experiência Mansão",
        description: "Imersões exclusivas",
        tasks: [
          "Participar da Experiência Mansão trimestral",
          "Fazer benchmarking com pares",
          "Participar de hot seats coletivos",
          "Expandir networking estratégico"
        ]
      },
      {
        name: "Direção Individual",
        description: "Sessões individuais",
        tasks: [
          "Realizar sessão de direção individual semestral",
          "Revisar plano estratégico anual",
          "Definir ajustes e novas metas",
          "Receber feedback direto sobre liderança"
        ]
      }
    ]
  },
  "sales-ops": {
    name: "UNV Sales Ops",
    tagline: "Padronização & Treinamento de Times",
    deliverables: [
      "Trilhas por cargo (SDR, Closer, Gestor)",
      "Avaliações e scorecards",
      "Scripts por cargo",
      "Metas e KPIs por cargo",
      "Cobrança via trilhas",
      "UNV AI Advisor por cargo"
    ],
    problemsSolved: [
      { problem: "Onboarding demora meses", solution: "Trilhas estruturadas", result: "Vendedor produzindo em semanas" },
      { problem: "Conhecimento vai embora", solution: "Tudo documentado", result: "Empresa não perde performance" },
      { problem: "Cada um faz de um jeito", solution: "Scripts + scorecards", result: "Resultado previsível" },
      { problem: "Gestor não desenvolve", solution: "Avaliações + trilhas", result: "Caminho claro de evolução" }
    ],
    keyBenefits: ["Onboarding acelerado", "Conhecimento documentado", "Padronização", "Desenvolvimento individual"],
    timeToResults: "Impacto imediato no onboarding, padronização em 60-90 dias",
    phases: [
      {
        name: "Mapeamento",
        description: "Levantamento das funções e processos",
        tasks: [
          "Mapear funções comerciais existentes (SDR, Closer, Gestor)",
          "Levantar processos atuais de cada função",
          "Identificar gaps de conhecimento e treinamento",
          "Definir competências-chave por cargo",
          "Priorizar trilhas a serem desenvolvidas"
        ]
      },
      {
        name: "Trilha SDR",
        description: "Desenvolvimento da trilha de SDR",
        tasks: [
          "Desenvolver conteúdo da trilha SDR",
          "Criar scripts de prospecção e qualificação",
          "Definir métricas e metas específicas de SDR",
          "Criar avaliação e scorecard de SDR",
          "Configurar AI Advisor para SDR"
        ]
      },
      {
        name: "Trilha Closer",
        description: "Desenvolvimento da trilha de Closer",
        tasks: [
          "Desenvolver conteúdo da trilha Closer",
          "Criar scripts de apresentação e fechamento",
          "Definir métricas e metas específicas de Closer",
          "Criar avaliação e scorecard de Closer",
          "Configurar AI Advisor para Closer"
        ]
      },
      {
        name: "Trilha Gestor",
        description: "Desenvolvimento da trilha de Gestor",
        tasks: [
          "Desenvolver conteúdo da trilha Gestor",
          "Criar frameworks de gestão de time",
          "Definir rituais de gestão obrigatórios",
          "Criar avaliação e scorecard de Gestor",
          "Configurar AI Advisor para Gestor"
        ]
      },
      {
        name: "Implementação",
        description: "Colocar trilhas em operação",
        tasks: [
          "Treinar time nas trilhas desenvolvidas",
          "Implementar sistema de acompanhamento via trilhas",
          "Realizar primeiras avaliações com scorecards",
          "Ajustar trilhas conforme feedback",
          "Estabelecer rotina de treinamentos quinzenais"
        ]
      }
    ]
  },
  ads: {
    name: "UNV Ads",
    tagline: "Tráfego & Geração de Demanda",
    deliverables: [
      "Gestão completa de tráfego",
      "Diagnóstico de demanda",
      "Estruturação de funil de aquisição",
      "Copies otimizadas",
      "Métricas CPL/CAC",
      "Otimização semanal",
      "Integração marketing/vendas",
      "Geração de leads qualificados"
    ],
    problemsSolved: [
      { problem: "Poucos leads", solution: "Campanhas estruturadas", result: "Leads no volume certo" },
      { problem: "Leads sem qualidade", solution: "Funil de aquisição qualificado", result: "Leads mais preparados" },
      { problem: "Marketing e vendas não conversam", solution: "Integração completa", result: "ROI rastreado até venda" },
      { problem: "Investe no escuro", solution: "Métricas CPL/CAC claras", result: "Clareza do ROI" }
    ],
    keyBenefits: ["Volume qualificado", "Integração marketing/vendas", "Métricas claras", "Otimização contínua"],
    timeToResults: "Primeiros leads em 7-14 dias, otimização em 60-90 dias",
    phases: [
      {
        name: "Diagnóstico",
        description: "Análise da operação de marketing",
        tasks: [
          "Realizar diagnóstico de demanda atual",
          "Analisar histórico de campanhas (se houver)",
          "Mapear canais com potencial",
          "Definir ICP para campanhas",
          "Estabelecer metas de CPL e volume"
        ]
      },
      {
        name: "Estruturação",
        description: "Montagem do funil de aquisição",
        tasks: [
          "Estruturar funil de aquisição com landing pages",
          "Criar materiais de conversão (ebooks, webinars, etc)",
          "Configurar pixel e tracking de conversões",
          "Integrar formulários com CRM",
          "Definir fluxo de qualificação pós-lead"
        ]
      },
      {
        name: "Campanhas",
        description: "Criação e lançamento de campanhas",
        tasks: [
          "Desenvolver copies otimizadas para anúncios",
          "Criar criativos (imagens/vídeos)",
          "Configurar campanhas no Meta/Google Ads",
          "Definir segmentações e públicos",
          "Lançar campanhas iniciais"
        ]
      },
      {
        name: "Otimização",
        description: "Melhoria contínua",
        tasks: [
          "Realizar otimização semanal de campanhas",
          "Testar novas copies e criativos (A/B)",
          "Analisar métricas CPL/CAC semanalmente",
          "Reportar resultados para time comercial",
          "Ajustar orçamento conforme performance"
        ]
      },
      {
        name: "Integração",
        description: "Conexão marketing e vendas",
        tasks: [
          "Implementar reunião semanal marketing/vendas",
          "Criar dashboard integrado de resultados",
          "Rastrear leads até fechamento de vendas",
          "Calcular ROI real das campanhas",
          "Ajustar campanhas com base em feedback de vendas"
        ]
      }
    ]
  },
  social: {
    name: "UNV Social",
    tagline: "Social Media como Canal de Vendas",
    deliverables: [
      "Estratégia de conteúdo completa",
      "Diagnóstico de posicionamento",
      "Conteúdo de pré-venda",
      "Construção de autoridade",
      "Integração marketing/vendas",
      "UNV AI Advisor Social"
    ],
    problemsSolved: [
      { problem: "Ciclo longo demais", solution: "Conteúdo de pré-venda", result: "Lead chega preparado" },
      { problem: "Falta autoridade", solution: "Construção de autoridade", result: "Vira referência" },
      { problem: "Redes não vendem", solution: "Conteúdo estratégico", result: "Social gera leads" },
      { problem: "Não sabe o que postar", solution: "Estratégia completa", result: "Calendário claro" }
    ],
    keyBenefits: ["Autoridade", "Ciclo de vendas menor", "Conteúdo que gera leads", "Posicionamento"],
    timeToResults: "Posicionamento em 30 dias, autoridade em 90-180 dias",
    phases: [
      {
        name: "Diagnóstico",
        description: "Análise do posicionamento atual",
        tasks: [
          "Realizar diagnóstico de posicionamento atual nas redes",
          "Analisar concorrentes e benchmarks",
          "Definir tom de voz e personalidade da marca",
          "Identificar temas-chave do negócio",
          "Mapear públicos e canais prioritários"
        ]
      },
      {
        name: "Estratégia",
        description: "Desenvolvimento da estratégia de conteúdo",
        tasks: [
          "Desenvolver estratégia de conteúdo completa",
          "Criar pilares de conteúdo",
          "Definir formatos por canal (stories, reels, posts)",
          "Criar calendário editorial mensal",
          "Estabelecer métricas de acompanhamento"
        ]
      },
      {
        name: "Produção",
        description: "Criação de conteúdo",
        tasks: [
          "Produzir conteúdo de pré-venda",
          "Criar conteúdo de autoridade",
          "Desenvolver cases e provas sociais",
          "Criar conteúdo educativo do segmento",
          "Produzir conteúdo de bastidores"
        ]
      },
      {
        name: "Publicação",
        description: "Execução e monitoramento",
        tasks: [
          "Publicar conteúdo conforme calendário",
          "Monitorar engajamento e comentários",
          "Responder DMs e interações",
          "Analisar performance semanal",
          "Ajustar estratégia conforme dados"
        ]
      },
      {
        name: "Integração",
        description: "Conexão com vendas",
        tasks: [
          "Integrar conteúdo com campanhas de vendas",
          "Criar fluxo de leads via DM/stories",
          "Reportar leads gerados via social",
          "Alinhar com time comercial sobre objeções/dúvidas",
          "Mensurar impacto no ciclo de vendas"
        ]
      }
    ]
  },
  leadership: {
    name: "UNV Leadership",
    tagline: "Formação de Liderança",
    deliverables: [
      "Diagnóstico de liderança",
      "PDI individual",
      "Formação em 4 dimensões",
      "Gestão de pessoas e performance",
      "Roteiros de feedback",
      "Rituais de cultura",
      "Avaliação contínua",
      "UNV AI Advisor Leadership",
      "Encontros híbridos"
    ],
    problemsSolved: [
      { problem: "Líderes não cobram", solution: "Formação em gestão de performance", result: "Líderes que desenvolvem" },
      { problem: "Técnico virou péssimo gestor", solution: "PDI + 4 dimensões de liderança", result: "Gestores de verdade" },
      { problem: "Cultura depende do dono", solution: "Rituais de cultura", result: "Cultura sustentada" },
      { problem: "Alta rotatividade", solution: "Gestão de pessoas", result: "Times estáveis" }
    ],
    keyBenefits: ["Líderes que cobram", "Cultura independente", "Menos turnover", "Gestores de verdade"],
    timeToResults: "Primeiras mudanças em 30-60 dias, transformação em 6 meses",
    phases: [
      {
        name: "Diagnóstico",
        description: "Avaliação dos líderes",
        tasks: [
          "Realizar diagnóstico de liderança de cada gestor",
          "Identificar gaps de competências por líder",
          "Mapear perfil comportamental (DISC ou similar)",
          "Levantar feedback do time sobre liderança",
          "Priorizar áreas de desenvolvimento"
        ]
      },
      {
        name: "PDI",
        description: "Plano de Desenvolvimento Individual",
        tasks: [
          "Criar PDI individual para cada líder",
          "Definir metas de desenvolvimento trimestrais",
          "Estabelecer indicadores de evolução",
          "Agendar acompanhamento mensal de PDI"
        ]
      },
      {
        name: "Formação Dimensão 1-2",
        description: "Gestão de Resultados e Pessoas",
        tasks: [
          "Treinar em Gestão de Resultados (metas, KPIs, cobrança)",
          "Treinar em Gestão de Pessoas (feedback, desenvolvimento)",
          "Aplicar roteiros de feedback",
          "Praticar conversas difíceis em roleplay",
          "Avaliar absorção e prática"
        ]
      },
      {
        name: "Formação Dimensão 3-4",
        description: "Cultura e Estratégia",
        tasks: [
          "Treinar em Gestão de Cultura (rituais, valores)",
          "Treinar em Gestão Estratégica (visão, planejamento)",
          "Implementar rituais de cultura no time",
          "Criar plano estratégico de área",
          "Avaliar evolução geral"
        ]
      },
      {
        name: "Acompanhamento",
        description: "Avaliação e melhoria contínua",
        tasks: [
          "Realizar avaliação trimestral de líderes",
          "Revisar PDIs e ajustar conforme evolução",
          "Conduzir encontros híbridos de liderança",
          "Coletar feedback do time sobre evolução",
          "Planejar próximo ciclo de desenvolvimento"
        ]
      }
    ]
  },
  mastermind: {
    name: "UNV Mastermind",
    tagline: "Inner Circle de Líderes",
    deliverables: [
      "Sessões de hot seat mensais",
      "Mansão Empresarial mensal",
      "Board coletivo de decisão",
      "Direção individual 2x/ano",
      "Comunidade ultra seletiva",
      "UNV AI Advisor Mastermind"
    ],
    problemsSolved: [
      { problem: "Decisões complexas", solution: "Hot seats com pares", result: "Decisões mais seguras" },
      { problem: "Solidão extrema", solution: "Mansão mensal", result: "Espaço seguro" },
      { problem: "Só bajulação", solution: "Comunidade que confronta", result: "Feedback real" },
      { problem: "Poderia estar maior", solution: "Board + direção individual", result: "Clareza do próximo nível" }
    ],
    keyBenefits: ["Conselho de pares", "Ambiente confidencial", "Confrontação honesta", "Próximo nível"],
    timeToResults: "Impacto imediato, transformação em 12 meses",
    phases: [
      {
        name: "Onboarding Mastermind",
        description: "Integração ao grupo",
        tasks: [
          "Realizar entrevista de seleção e alinhamento",
          "Apresentar ao grupo na primeira Mansão",
          "Configurar UNV AI Advisor Mastermind",
          "Integrar à comunidade ultra seletiva",
          "Agendar primeiro hot seat"
        ]
      },
      {
        name: "Hot Seats Mensais",
        description: "Sessões de resolução de problemas",
        tasks: [
          "Preparar pauta para hot seat mensal",
          "Participar de hot seat (apresentar ou contribuir)",
          "Receber feedback e perspectivas dos pares",
          "Documentar insights e decisões",
          "Executar ações definidas"
        ]
      },
      {
        name: "Mansão Empresarial",
        description: "Imersões mensais",
        tasks: [
          "Participar da Mansão Empresarial mensal",
          "Compartilhar resultados e desafios",
          "Fazer benchmark com pares",
          "Expandir networking estratégico",
          "Planejar próximo mês com clareza"
        ]
      },
      {
        name: "Board Coletivo",
        description: "Decisões em grupo",
        tasks: [
          "Participar do board coletivo de decisão",
          "Contribuir com perspectivas para outros",
          "Receber conselhos sobre decisões importantes",
          "Documentar aprendizados"
        ]
      },
      {
        name: "Direção Individual",
        description: "Sessões individuais",
        tasks: [
          "Realizar direção individual semestral (1ª sessão)",
          "Revisar metas e resultados do semestre",
          "Realizar direção individual semestral (2ª sessão)",
          "Definir plano para próximo período"
        ]
      }
    ]
  },
  "sales-force": {
    name: "UNV Sales Force",
    tagline: "Operação Comercial Terceirizada",
    deliverables: [
      "SDR e/ou Closer operando diretamente",
      "Adaptação de scripts à operação",
      "Definição de métricas de performance",
      "Execução diária de prospecção/fechamento",
      "Ajustes semanais de abordagem",
      "Report mensal completo"
    ],
    problemsSolved: [
      { problem: "Leads não convertem", solution: "Closer experiente", result: "Receita capturada" },
      { problem: "Não consegue contratar", solution: "Operação terceirizada", result: "Performance imediata" },
      { problem: "Precisa vender rápido", solution: "Operação pronta", result: "Capacidade imediata" },
      { problem: "Não consegue gerenciar", solution: "Gestão inclusa", result: "Só acompanha resultados" }
    ],
    keyBenefits: ["Execução imediata", "Sem custo de contratação", "Profissionais experientes", "Gestão inclusa"],
    timeToResults: "Operação rodando em 2-3 semanas, resultados em 30-60 dias",
    phases: [
      {
        name: "Onboarding",
        description: "Preparação da operação",
        tasks: [
          "Realizar diagnóstico da operação atual",
          "Definir escopo (SDR, Closer ou ambos)",
          "Levantar informações do produto/serviço",
          "Mapear objeções comuns e respostas",
          "Definir métricas de performance esperadas"
        ]
      },
      {
        name: "Adaptação",
        description: "Personalização da abordagem",
        tasks: [
          "Adaptar scripts de abordagem à operação",
          "Configurar acessos (CRM, WhatsApp, etc)",
          "Definir fluxo de passagem de leads",
          "Alinhar processo de fechamento",
          "Realizar simulações de abordagem"
        ]
      },
      {
        name: "Operação",
        description: "Execução diária",
        tasks: [
          "Iniciar execução diária de prospecção/fechamento",
          "Registrar todas as atividades no CRM",
          "Reportar resultados diários",
          "Escalar objeções não mapeadas",
          "Manter ritmo de atividades"
        ]
      },
      {
        name: "Ajustes",
        description: "Otimização semanal",
        tasks: [
          "Realizar reunião semanal de ajustes",
          "Analisar métricas de conversão",
          "Ajustar scripts conforme feedback",
          "Testar novas abordagens",
          "Refinar processo de passagem"
        ]
      },
      {
        name: "Report",
        description: "Relatórios e prestação de contas",
        tasks: [
          "Preparar report mensal completo",
          "Apresentar resultados ao cliente",
          "Analisar ROI da operação",
          "Definir metas do próximo mês",
          "Planejar ajustes estruturais se necessário"
        ]
      }
    ]
  },
  "le-desir": {
    name: "Le Désir",
    tagline: "Análise Estratégica para Líderes",
    deliverables: [
      "Sessões individuais semanais ou quinzenais",
      "Ambiente 100% confidencial",
      "Análise de padrões de decisão",
      "Suporte emocional de liderança",
      "Processo analítico sem agenda fixa"
    ],
    problemsSolved: [
      { problem: "Exaustão mental", solution: "Sessões para processar", result: "Clareza mental" },
      { problem: "Padrões destrutivos", solution: "Análise de padrões", result: "Consciência de mudar" },
      { problem: "Solidão extrema", solution: "Ambiente confidencial", result: "Espaço seguro" },
      { problem: "Decisões reativas", solution: "Processo analítico", result: "Decisões conscientes" }
    ],
    keyBenefits: ["Clareza mental", "Espaço confidencial", "Autoconhecimento", "Decisões equilibradas"],
    timeToResults: "Alívio imediato, transformação em 6-12 meses",
    phases: [
      {
        name: "Início",
        description: "Primeiras sessões",
        tasks: [
          "Realizar sessão inicial de acolhimento",
          "Mapear principais dores e demandas",
          "Definir frequência (semanal ou quinzenal)",
          "Estabelecer contrato de confidencialidade",
          "Iniciar processo analítico"
        ]
      },
      {
        name: "Processo",
        description: "Sessões regulares",
        tasks: [
          "Realizar sessões conforme frequência definida",
          "Analisar padrões de comportamento",
          "Trabalhar questões de liderança",
          "Processar situações difíceis",
          "Desenvolver autoconhecimento"
        ]
      },
      {
        name: "Acompanhamento",
        description: "Evolução contínua",
        tasks: [
          "Avaliar evolução trimestral",
          "Ajustar foco conforme momento",
          "Celebrar progressos e insights",
          "Continuar processo de desenvolvimento"
        ]
      }
    ]
  },
  finance: {
    name: "UNV Finance",
    tagline: "Controle Financeiro Estratégico",
    deliverables: [
      "Estruturação financeira completa",
      "DRE gerencial mensal",
      "Controle de fluxo de caixa",
      "Análise de margem por produto",
      "Suporte em decisões financeiras",
      "Projeção de caixa 90 dias"
    ],
    problemsSolved: [
      { problem: "Não sobra dinheiro", solution: "DRE gerencial", result: "Clareza de onde vai" },
      { problem: "Não sabe margem", solution: "Análise por produto", result: "Sabe o que priorizar" },
      { problem: "Medo de investir", solution: "Projeção de caixa", result: "Investe com segurança" },
      { problem: "Estresse financeiro", solution: "Controle de fluxo", result: "Tranquilidade" }
    ],
    keyBenefits: ["Clareza financeira", "Decisões seguras", "Margem clara", "Projeção de caixa"],
    timeToResults: "Clareza em 30 dias, controle em 90 dias",
    phases: [
      {
        name: "Diagnóstico",
        description: "Análise financeira inicial",
        tasks: [
          "Levantar dados financeiros atuais",
          "Mapear estrutura de receitas e custos",
          "Identificar principais vazamentos",
          "Definir categorias do DRE gerencial",
          "Estabelecer metas financeiras"
        ]
      },
      {
        name: "Estruturação",
        description: "Montagem da estrutura financeira",
        tasks: [
          "Implementar DRE gerencial mensal",
          "Estruturar controle de fluxo de caixa",
          "Criar modelo de análise por produto/serviço",
          "Configurar projeção de caixa 90 dias",
          "Treinar responsável financeiro"
        ]
      },
      {
        name: "Operação",
        description: "Rotina financeira mensal",
        tasks: [
          "Fechar DRE gerencial do mês",
          "Atualizar fluxo de caixa",
          "Analisar margens por produto",
          "Revisar projeção de 90 dias",
          "Identificar ações de melhoria"
        ]
      },
      {
        name: "Decisões",
        description: "Suporte estratégico",
        tasks: [
          "Participar de decisões de investimento",
          "Analisar viabilidade de projetos",
          "Suportar negociações financeiras",
          "Avaliar cenários e riscos"
        ]
      }
    ]
  },
  people: {
    name: "UNV People",
    tagline: "Gestão Estratégica de Pessoas",
    deliverables: [
      "Diagnóstico de vagas e perfis",
      "Processo de contratação estruturado",
      "Triagem e entrevistas",
      "Onboarding 30-60-90",
      "Avaliação de performance",
      "Desenvolvimento de líderes",
      "Indicadores de pessoas"
    ],
    problemsSolved: [
      { problem: "Contrata errado", solution: "Processo estruturado", result: "Contrata certo" },
      { problem: "Onboarding longo", solution: "Onboarding 30-60-90", result: "Produz em semanas" },
      { problem: "Não sabe quem performa", solution: "Avaliação estruturada", result: "Clareza de decisão" },
      { problem: "Alta rotatividade", solution: "Indicadores + desenvolvimento", result: "Times estáveis" }
    ],
    keyBenefits: ["Contratação assertiva", "Onboarding acelerado", "Avaliação clara", "Menos turnover"],
    timeToResults: "Primeira contratação em 30 dias, estrutura em 90 dias",
    phases: [
      {
        name: "Diagnóstico",
        description: "Análise de pessoas",
        tasks: [
          "Mapear organograma atual",
          "Identificar vagas e perfis necessários",
          "Levantar processos de contratação existentes",
          "Avaliar turnover e causas",
          "Priorizar ações de people"
        ]
      },
      {
        name: "Contratação",
        description: "Estruturação de recrutamento",
        tasks: [
          "Estruturar processo de contratação",
          "Definir perfis de vaga com scorecards",
          "Criar roteiro de entrevistas",
          "Implementar triagem estruturada",
          "Treinar líderes em entrevistas"
        ]
      },
      {
        name: "Onboarding",
        description: "Estrutura de integração",
        tasks: [
          "Criar programa de onboarding 30-60-90",
          "Definir marcos de evolução",
          "Criar materiais de integração",
          "Implementar check-ins de onboarding",
          "Avaliar efetividade do onboarding"
        ]
      },
      {
        name: "Avaliação",
        description: "Performance e desenvolvimento",
        tasks: [
          "Implementar avaliação de performance",
          "Definir indicadores de pessoas",
          "Criar planos de desenvolvimento",
          "Estruturar feedback recorrente",
          "Treinar líderes em gestão de performance"
        ]
      }
    ]
  },
  safe: {
    name: "UNV Safe",
    tagline: "Legal, Risk & Compliance Advisory",
    deliverables: [
      "Análise de riscos da operação",
      "Padronização de contratos",
      "Consultoria jurídica contínua",
      "Orientação trabalhista (CLT, PJ, terceirização)",
      "LGPD e compliance básico",
      "Suporte para decisões estratégicas"
    ],
    problemsSolved: [
      { problem: "Contratos sem padrão", solution: "Padronização completa", result: "Contratos que protegem" },
      { problem: "Sem respaldo jurídico", solution: "Consultoria contínua", result: "Decisões seguras" },
      { problem: "Riscos trabalhistas", solution: "Orientação trabalhista", result: "Menos passivos" },
      { problem: "LGPD negligenciada", solution: "Adequação básica", result: "Em conformidade" }
    ],
    keyBenefits: ["Segurança jurídica", "Menos risco", "Contratos padronizados", "Jurídico preventivo"],
    timeToResults: "Contratos em 30 dias, proteção contínua",
    phases: [
      {
        name: "Diagnóstico",
        description: "Análise de riscos",
        tasks: [
          "Realizar análise de riscos da operação",
          "Levantar contratos existentes",
          "Identificar gaps trabalhistas",
          "Avaliar situação de LGPD",
          "Priorizar ações jurídicas"
        ]
      },
      {
        name: "Contratos",
        description: "Padronização contratual",
        tasks: [
          "Padronizar contrato de clientes",
          "Padronizar contrato de vendedores/prestadores",
          "Criar termos de uso e políticas",
          "Revisar contratos com parceiros",
          "Treinar time em uso dos contratos"
        ]
      },
      {
        name: "Trabalhista",
        description: "Orientação de relações de trabalho",
        tasks: [
          "Estruturar relações CLT",
          "Organizar contratos PJ",
          "Definir políticas de terceirização",
          "Criar documentação de cargos e funções",
          "Prevenir passivos trabalhistas"
        ]
      },
      {
        name: "Compliance",
        description: "LGPD e conformidade",
        tasks: [
          "Implementar adequação básica LGPD",
          "Criar políticas de privacidade",
          "Adequar formulários e termos",
          "Treinar time em proteção de dados",
          "Monitorar conformidade"
        ]
      },
      {
        name: "Consultoria",
        description: "Suporte contínuo",
        tasks: [
          "Suportar decisões estratégicas com análise jurídica",
          "Responder demandas jurídicas pontuais",
          "Revisar novos contratos e acordos",
          "Prevenir riscos identificados"
        ]
      }
    ]
  },
  "ai-sales-system": {
    name: "UNV Sales System",
    tagline: "Inteligência Comercial Autônoma",
    deliverables: [
      "CRM inteligente com lead scoring por IA",
      "Agentes de IA autônomos (SDR, Atendimento, Qualificação)",
      "Atendimento via WhatsApp e Instagram",
      "Prospecção automatizada (exclusivo B2B)",
      "Orquestração de funil e follow-ups",
      "Playbooks e regras de negócio",
      "Implementação guiada",
      "Aprendizado contínuo com dados reais"
    ],
    problemsSolved: [
      { problem: "SDR caro", solution: "Agentes de IA", result: "Escala sem aumentar custo" },
      { problem: "Follow-ups esquecidos", solution: "Orquestração automática", result: "Nenhum lead esquecido" },
      { problem: "CRM improdutivo", solution: "CRM com lead scoring IA", result: "Priorização inteligente" },
      { problem: "Atendimento lento", solution: "Agentes 24/7", result: "Atendimento instantâneo" }
    ],
    keyBenefits: ["Escala sem time", "Atendimento 24/7", "Menor custo por venda", "ROI em 60 dias"],
    timeToResults: "Setup em 2-4 semanas, resultados no primeiro mês",
    phases: [
      {
        name: "Discovery",
        description: "Entendimento da operação",
        tasks: [
          "Mapear processo comercial atual",
          "Identificar pontos de automação",
          "Definir escopo de agentes (SDR, atendimento, qualificação)",
          "Levantar integrações necessárias (WhatsApp, Instagram, CRM)",
          "Definir métricas de sucesso"
        ]
      },
      {
        name: "Setup",
        description: "Configuração do sistema",
        tasks: [
          "Configurar CRM inteligente",
          "Implementar lead scoring por IA",
          "Configurar agentes de IA",
          "Integrar WhatsApp e Instagram",
          "Criar playbooks e regras de negócio"
        ]
      },
      {
        name: "Treinamento IA",
        description: "Alimentação e ajustes",
        tasks: [
          "Treinar IA com dados históricos",
          "Configurar respostas e fluxos",
          "Definir escalação para humanos",
          "Testar cenários de atendimento",
          "Ajustar tom de voz e abordagem"
        ]
      },
      {
        name: "Go-live",
        description: "Lançamento da operação",
        tasks: [
          "Ativar agentes em produção",
          "Monitorar primeiras interações",
          "Corrigir falhas identificadas",
          "Treinar time em supervisão dos agentes",
          "Estabelecer rotina de acompanhamento"
        ]
      },
      {
        name: "Otimização",
        description: "Melhoria contínua",
        tasks: [
          "Analisar métricas semanais",
          "Ajustar fluxos com base em dados",
          "Expandir capacidades dos agentes",
          "Implementar novos casos de uso",
          "Calcular ROI e reportar resultados"
        ]
      }
    ]
  },
  "fractional-cro": {
    name: "UNV Fractional CRO",
    tagline: "Diretor Comercial Terceirizado",
    deliverables: [
      "CRM incluso (bônus)",
      "Reunião diária com vendedores (seg a sex)",
      "Acompanhamento via grupo de WhatsApp",
      "Ligações pontuais para correções imediatas",
      "Ponto de controle com vendedores abaixo da meta",
      "Acompanhamento semanal individual",
      "Reunião semanal com o proprietário",
      "Reunião mensal de fechamento",
      "Gestão diária do pipeline",
      "Cobrança de metas e execução",
      "Gestão de indicadores comerciais",
      "Desenvolvimento prático dos vendedores"
    ],
    problemsSolved: [
      { problem: "Sem cobrança diária", solution: "Reunião diária", result: "Ritmo e disciplina" },
      { problem: "Dono vira chefe de vendas", solution: "CRO terceirizado", result: "Dono livre para ser CEO" },
      { problem: "Metas não acompanhadas", solution: "Reunião semanal + mensal", result: "Previsibilidade" },
      { problem: "Decisões sem dados", solution: "Gestão de indicadores", result: "Decisões baseadas em dados" }
    ],
    keyBenefits: ["Direção diária", "WhatsApp + ligações", "Cobrança real", "Sem CLT"],
    timeToResults: "Rotina em 30 dias, resultados em 60-90 dias",
    phases: [
      {
        name: "Onboarding",
        description: "Integração à operação",
        tasks: [
          "Realizar diagnóstico da operação de vendas",
          "Mapear vendedores e performance atual",
          "Configurar CRM (se necessário)",
          "Criar grupo de WhatsApp da operação",
          "Definir metas e indicadores iniciais"
        ]
      },
      {
        name: "Rotina Diária",
        description: "Gestão diária do time",
        tasks: [
          "Implementar reunião diária (15-30min)",
          "Cobrar pipeline e atividades diárias",
          "Acompanhar vendedores via WhatsApp",
          "Fazer ligações de correção imediata",
          "Registrar pontos de controle"
        ]
      },
      {
        name: "Rotina Semanal",
        description: "Acompanhamento semanal",
        tasks: [
          "Realizar reunião semanal com proprietário",
          "Fazer acompanhamento individual por vendedor",
          "Analisar métricas da semana",
          "Identificar vendedores abaixo da meta",
          "Definir ações de correção"
        ]
      },
      {
        name: "Rotina Mensal",
        description: "Fechamento e planejamento",
        tasks: [
          "Realizar reunião mensal de fechamento",
          "Analisar resultados vs metas",
          "Desenvolver vendedores com gaps",
          "Definir metas do próximo mês",
          "Reportar resultados ao proprietário"
        ]
      }
    ]
  },
  "execution-partnership": {
    name: "UNV Execution Partnership",
    tagline: "Implementação Comercial com Fabrício Nunnes",
    deliverables: [
      "Novo modelo de gestão comercial implementado",
      "Rotina semanal e mensal de cobrança funcionando",
      "Metas por função definidas",
      "Funil estruturado e acompanhado",
      "Liderança treinada e operante",
      "Previsibilidade mínima de receita",
      "Plano pós-90 dias"
    ],
    problemsSolved: [
      { problem: "Gestão desestruturada", solution: "Reestruturação completa em 90 dias", result: "Time funcionando sem dono" },
      { problem: "Sem previsibilidade", solution: "Funil + metas + rotina", result: "Visão clara do pipeline" },
      { problem: "Liderança fraca", solution: "Treinamento + cobrança direta", result: "Líderes operantes" },
      { problem: "Crescimento travado", solution: "Diagnóstico + implementação", result: "Base para escala" }
    ],
    keyBenefits: ["Fabrício na operação", "Reunião semanal", "Implementação prática", "Payback em 90 dias"],
    timeToResults: "Clareza mês 1, implementação mês 2, resultados mês 3",
    phases: [
      {
        name: "Mês 1 - Diagnóstico",
        description: "Análise profunda e planejamento",
        tasks: [
          "Realizar diagnóstico profundo da operação comercial",
          "Mapear liderança e capacidades",
          "Identificar gargalos estruturais",
          "Definir modelo de gestão a ser implementado",
          "Criar plano de 90 dias com marcos semanais"
        ]
      },
      {
        name: "Mês 2 - Implementação",
        description: "Execução das mudanças",
        tasks: [
          "Implementar novo modelo de gestão comercial",
          "Estruturar rotina semanal de cobrança",
          "Treinar liderança comercial",
          "Definir metas por função",
          "Reestruturar funil de vendas"
        ]
      },
      {
        name: "Mês 3 - Consolidação",
        description: "Resultados e transição",
        tasks: [
          "Consolidar rotina mensal de fechamento",
          "Validar funcionamento autônomo da liderança",
          "Mensurar resultados vs investimento",
          "Criar plano pós-90 dias",
          "Avaliar continuidade ou transição"
        ]
      },
      {
        name: "Acompanhamento",
        description: "Reuniões estratégicas semanais",
        tasks: [
          "Realizar reunião estratégica semanal com Fabrício",
          "Cobrar execução do plano",
          "Ajustar rota conforme resultados",
          "Tomar decisões difíceis sobre pessoas/processos"
        ]
      }
    ]
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, companyId, context } = await req.json();

    console.log("Generating tasks for project:", projectId);

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

    if (!project) {
      throw new Error("Project not found");
    }

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

    // Get product-specific deliverables
    const productId = project.product_id;
    const productConfig = PRODUCT_DELIVERABLES[productId];

    if (!productConfig) {
      console.log("No specific config for product:", productId, "- using AI generation");
      // Fallback to AI generation for products without specific config
      return await generateWithAI(req, project, company, existingTaskTitles, context, LOVABLE_API_KEY);
    }

    console.log("Using product-specific tasks for:", productConfig.name);

    // Generate tasks from product phases with calculated due dates
    const tasks: {
      title: string;
      description: string;
      phase: string;
      priority: string;
      responsible_role: string;
      estimated_days: number;
      due_date: string | null;
    }[] = [];

    const companyName = company?.name || "a empresa";
    const projectCreatedAt = new Date(project.created_at);
    let daysOffset = 0;

    for (const phase of productConfig.phases) {
      const phaseIndex = productConfig.phases.indexOf(phase);
      
      for (const taskTitle of phase.tasks) {
        // Skip if task already exists
        if (existingTaskTitles.includes(taskTitle.toLowerCase())) {
          continue;
        }

        // Personalize task title with company name
        const personalizedTitle = taskTitle.replace(/a empresa|o cliente/gi, companyName);

        // Determine priority based on phase order
        let priority = "medium";
        if (phaseIndex === 0) priority = "high";
        if (phaseIndex === productConfig.phases.length - 1) priority = "low";

        // Determine responsible role
        let responsible_role = "consultant";
        if (taskTitle.toLowerCase().includes("cliente") || 
            taskTitle.toLowerCase().includes("preencher") ||
            taskTitle.toLowerCase().includes("enviar dados")) {
          responsible_role = "client";
        } else if (taskTitle.toLowerCase().includes("acompanhamento") ||
                   taskTitle.toLowerCase().includes("check-in") ||
                   taskTitle.toLowerCase().includes("suporte")) {
          responsible_role = "cs";
        }

        // Estimate days based on task complexity
        let estimated_days = 3;
        if (taskTitle.toLowerCase().includes("diagnóstico") || 
            taskTitle.toLowerCase().includes("estruturar") ||
            taskTitle.toLowerCase().includes("implementar")) {
          estimated_days = 7;
        } else if (taskTitle.toLowerCase().includes("reunião") ||
                   taskTitle.toLowerCase().includes("check-in") ||
                   taskTitle.toLowerCase().includes("mensal")) {
          estimated_days = 1;
        }

        // Calculate due date based on phase and task order
        // Each phase gets proportional time based on 12 months
        const phaseDuration = Math.ceil(365 / productConfig.phases.length); // days per phase
        const phaseStartDay = phaseIndex * phaseDuration;
        const taskIndex = phase.tasks.indexOf(taskTitle);
        const taskSpacing = Math.ceil(phaseDuration / phase.tasks.length);
        const taskDueDay = phaseStartDay + (taskIndex * taskSpacing);
        
        const dueDate = new Date(projectCreatedAt.getTime() + taskDueDay * 24 * 60 * 60 * 1000);

        tasks.push({
          title: personalizedTitle,
          description: `${phase.description} - ${productConfig.name}\n\nParte das entregas: ${productConfig.deliverables.slice(0, 3).join(", ")}...`,
          phase: phase.name,
          priority,
          responsible_role,
          estimated_days,
          due_date: dueDate.toISOString().split("T")[0]
        });

        daysOffset += estimated_days;
      }
    }

    // Limit to reasonable number of tasks
    const limitedTasks = tasks.slice(0, 40);

    console.log(`Generated ${limitedTasks.length} tasks for ${productConfig.name}`);

    return new Response(
      JSON.stringify({ tasks: limitedTasks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-playbook-tasks:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fallback AI generation for products without specific config
async function generateWithAI(
  req: Request,
  project: any,
  company: any,
  existingTaskTitles: string[],
  context: string,
  apiKey: string
) {
  const companyContext = company ? `
## CONTEXTO DA EMPRESA
- Nome: ${company.name}
- Segmento: ${company.segment || "Não informado"}
- Descrição: ${company.company_description || "Não informado"}
- Principais Desafios: ${company.main_challenges || "Não informado"}
- Metas de Curto Prazo: ${company.goals_short_term || "Não informado"}
` : "";

  const projectContext = `
## CONTEXTO DO PROJETO
- Produto: ${project.product_name}
- Status: ${project.status}
`;

  const systemPrompt = `Você é um consultor da UNV. Gere tarefas de onboarding para o produto ${project.product_name}.

${companyContext}
${projectContext}

${context ? `Contexto adicional: ${context}` : ""}

Tarefas existentes (não repetir): ${existingTaskTitles.join(", ") || "Nenhuma"}

Gere 10-15 tarefas práticas e específicas para implementar o produto.

Retorne APENAS JSON válido:
{
  "tasks": [
    {
      "title": "Título da tarefa",
      "description": "Descrição detalhada",
      "phase": "Fase",
      "priority": "high|medium|low",
      "responsible_role": "consultant|cs|client",
      "estimated_days": número
    }
  ]
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Gere as tarefas de onboarding." }
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let aiResponse = data.choices?.[0]?.message?.content || "";

  aiResponse = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(aiResponse);

  return new Response(
    JSON.stringify({ tasks: parsed.tasks || [] }),
    { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } }
  );
}
