// Perguntas do DISC com 28 conjuntos de 4 adjetivos
// Cada pergunta tem 4 opções, uma para cada perfil (D, I, S, C)
// O respondente escolhe a que MAIS se identifica e a que MENOS se identifica

export interface DiscOption {
  text: string;
  profile: 'D' | 'I' | 'S' | 'C';
}

export interface DiscQuestion {
  id: number;
  options: DiscOption[];
}

export const discQuestions: DiscQuestion[] = [
  {
    id: 1,
    options: [
      { text: "Determinado", profile: "D" },
      { text: "Entusiasmado", profile: "I" },
      { text: "Paciente", profile: "S" },
      { text: "Cuidadoso", profile: "C" },
    ],
  },
  {
    id: 2,
    options: [
      { text: "Competitivo", profile: "D" },
      { text: "Alegre", profile: "I" },
      { text: "Leal", profile: "S" },
      { text: "Preciso", profile: "C" },
    ],
  },
  {
    id: 3,
    options: [
      { text: "Ousado", profile: "D" },
      { text: "Inspirador", profile: "I" },
      { text: "Calmo", profile: "S" },
      { text: "Perfeccionista", profile: "C" },
    ],
  },
  {
    id: 4,
    options: [
      { text: "Direto", profile: "D" },
      { text: "Otimista", profile: "I" },
      { text: "Estável", profile: "S" },
      { text: "Analítico", profile: "C" },
    ],
  },
  {
    id: 5,
    options: [
      { text: "Decidido", profile: "D" },
      { text: "Persuasivo", profile: "I" },
      { text: "Gentil", profile: "S" },
      { text: "Sistemático", profile: "C" },
    ],
  },
  {
    id: 6,
    options: [
      { text: "Independente", profile: "D" },
      { text: "Sociável", profile: "I" },
      { text: "Confiável", profile: "S" },
      { text: "Organizado", profile: "C" },
    ],
  },
  {
    id: 7,
    options: [
      { text: "Aventureiro", profile: "D" },
      { text: "Expressivo", profile: "I" },
      { text: "Cooperativo", profile: "S" },
      { text: "Meticuloso", profile: "C" },
    ],
  },
  {
    id: 8,
    options: [
      { text: "Assertivo", profile: "D" },
      { text: "Confiante", profile: "I" },
      { text: "Tolerante", profile: "S" },
      { text: "Detalhista", profile: "C" },
    ],
  },
  {
    id: 9,
    options: [
      { text: "Empreendedor", profile: "D" },
      { text: "Animado", profile: "I" },
      { text: "Acolhedor", profile: "S" },
      { text: "Diplomático", profile: "C" },
    ],
  },
  {
    id: 10,
    options: [
      { text: "Comandante", profile: "D" },
      { text: "Encantador", profile: "I" },
      { text: "Harmonioso", profile: "S" },
      { text: "Disciplinado", profile: "C" },
    ],
  },
  {
    id: 11,
    options: [
      { text: "Persistente", profile: "D" },
      { text: "Comunicativo", profile: "I" },
      { text: "Previsível", profile: "S" },
      { text: "Criterioso", profile: "C" },
    ],
  },
  {
    id: 12,
    options: [
      { text: "Corajoso", profile: "D" },
      { text: "Espontâneo", profile: "I" },
      { text: "Pacífico", profile: "S" },
      { text: "Reflexivo", profile: "C" },
    ],
  },
  {
    id: 13,
    options: [
      { text: "Objetivo", profile: "D" },
      { text: "Carismático", profile: "I" },
      { text: "Compreensivo", profile: "S" },
      { text: "Formal", profile: "C" },
    ],
  },
  {
    id: 14,
    options: [
      { text: "Resoluto", profile: "D" },
      { text: "Criativo", profile: "I" },
      { text: "Atencioso", profile: "S" },
      { text: "Reservado", profile: "C" },
    ],
  },
  {
    id: 15,
    options: [
      { text: "Ambicioso", profile: "D" },
      { text: "Influente", profile: "I" },
      { text: "Constante", profile: "S" },
      { text: "Cauteloso", profile: "C" },
    ],
  },
  {
    id: 16,
    options: [
      { text: "Pioneiro", profile: "D" },
      { text: "Popular", profile: "I" },
      { text: "Moderado", profile: "S" },
      { text: "Lógico", profile: "C" },
    ],
  },
  {
    id: 17,
    options: [
      { text: "Dominante", profile: "D" },
      { text: "Empolgante", profile: "I" },
      { text: "Solidário", profile: "S" },
      { text: "Técnico", profile: "C" },
    ],
  },
  {
    id: 18,
    options: [
      { text: "Vencedor", profile: "D" },
      { text: "Divertido", profile: "I" },
      { text: "Sincero", profile: "S" },
      { text: "Exato", profile: "C" },
    ],
  },
  {
    id: 19,
    options: [
      { text: "Ativo", profile: "D" },
      { text: "Amigável", profile: "I" },
      { text: "Relaxado", profile: "S" },
      { text: "Sensato", profile: "C" },
    ],
  },
  {
    id: 20,
    options: [
      { text: "Autossuficiente", profile: "D" },
      { text: "Convincente", profile: "I" },
      { text: "Bom ouvinte", profile: "S" },
      { text: "Investigador", profile: "C" },
    ],
  },
  {
    id: 21,
    options: [
      { text: "Líder", profile: "D" },
      { text: "Vibrante", profile: "I" },
      { text: "Conciliador", profile: "S" },
      { text: "Prudente", profile: "C" },
    ],
  },
  {
    id: 22,
    options: [
      { text: "Desafiador", profile: "D" },
      { text: "Generoso", profile: "I" },
      { text: "Dedicado", profile: "S" },
      { text: "Intelectual", profile: "C" },
    ],
  },
  {
    id: 23,
    options: [
      { text: "Produtivo", profile: "D" },
      { text: "Motivador", profile: "I" },
      { text: "Consistente", profile: "S" },
      { text: "Observador", profile: "C" },
    ],
  },
  {
    id: 24,
    options: [
      { text: "Dinâmico", profile: "D" },
      { text: "Extrovertido", profile: "I" },
      { text: "Tranquilo", profile: "S" },
      { text: "Estratégico", profile: "C" },
    ],
  },
  {
    id: 25,
    options: [
      { text: "Eficiente", profile: "D" },
      { text: "Simpático", profile: "I" },
      { text: "Flexível", profile: "S" },
      { text: "Cético", profile: "C" },
    ],
  },
  {
    id: 26,
    options: [
      { text: "Firme", profile: "D" },
      { text: "Entusiasta", profile: "I" },
      { text: "Receptivo", profile: "S" },
      { text: "Racional", profile: "C" },
    ],
  },
  {
    id: 27,
    options: [
      { text: "Inovador", profile: "D" },
      { text: "Cativante", profile: "I" },
      { text: "Ponderado", profile: "S" },
      { text: "Metódico", profile: "C" },
    ],
  },
  {
    id: 28,
    options: [
      { text: "Focado", profile: "D" },
      { text: "Positivo", profile: "I" },
      { text: "Apoiador", profile: "S" },
      { text: "Rigoroso", profile: "C" },
    ],
  },
];

// Descrições de cada perfil DISC
export const discProfiles = {
  D: {
    name: "Dominância",
    color: "#EF4444", // red
    emoji: "🦁",
    shortDesc: "Direto, Decidido, Orientado a Resultados",
    description: "Pessoas com perfil D são orientadas a resultados, gostam de desafios e tomam decisões rapidamente. São competitivas, assertivas e preferem estar no controle das situações.",
    strengths: [
      "Foco em resultados",
      "Tomada de decisão rápida",
      "Liderança natural",
      "Não tem medo de desafios",
      "Orientado a ação",
    ],
    challenges: [
      "Pode parecer impaciente",
      "Tendência a ser autoritário",
      "Dificuldade em ouvir os outros",
      "Pode ignorar detalhes",
      "Resistência a rotinas",
    ],
    communicationTips: [
      "Seja direto e objetivo",
      "Foque em resultados e eficiência",
      "Evite rodeios e conversas longas",
      "Apresente opções com benefícios claros",
      "Respeite seu tempo",
    ],
    idealEnvironment: "Ambiente competitivo com autonomia e desafios constantes",
    motivators: ["Poder", "Desafios", "Resultados", "Autonomia", "Variedade"],
  },
  I: {
    name: "Influência",
    color: "#F59E0B", // amber
    emoji: "🌟",
    shortDesc: "Entusiasta, Otimista, Comunicativo",
    description: "Pessoas com perfil I são comunicativas, entusiastas e otimistas. Gostam de interagir com outros, são persuasivas e preferem ambientes colaborativos e divertidos.",
    strengths: [
      "Excelente comunicação",
      "Entusiasmo contagiante",
      "Facilidade em networking",
      "Criatividade",
      "Capacidade de motivar outros",
    ],
    challenges: [
      "Dificuldade com detalhes",
      "Pode ser impulsivo",
      "Tendência a procrastinar",
      "Dificuldade com follow-up",
      "Pode prometer demais",
    ],
    communicationTips: [
      "Seja amigável e demonstre interesse pessoal",
      "Permita tempo para conversas sociais",
      "Use histórias e exemplos",
      "Reconheça suas ideias e contribuições",
      "Mantenha o ambiente leve e positivo",
    ],
    idealEnvironment: "Ambiente social, colaborativo e sem muitas restrições",
    motivators: ["Reconhecimento", "Aprovação social", "Popularidade", "Liberdade de expressão", "Diversão"],
  },
  S: {
    name: "Estabilidade",
    color: "#10B981", // green
    emoji: "🌳",
    shortDesc: "Calmo, Paciente, Confiável",
    description: "Pessoas com perfil S são pacientes, confiáveis e preferem ambientes estáveis. São ótimos ouvintes, apoiadores e valorizam harmonia e cooperação no trabalho.",
    strengths: [
      "Paciência excepcional",
      "Confiabilidade",
      "Excelente trabalho em equipe",
      "Boa capacidade de ouvir",
      "Lealdade",
    ],
    challenges: [
      "Resistência a mudanças",
      "Dificuldade em dizer não",
      "Pode evitar conflitos necessários",
      "Lentidão na tomada de decisão",
      "Passividade excessiva",
    ],
    communicationTips: [
      "Seja paciente e gentil",
      "Dê tempo para processar informações",
      "Forneça segurança e estabilidade",
      "Evite pressão excessiva",
      "Valorize sua contribuição para a equipe",
    ],
    idealEnvironment: "Ambiente estável, harmonioso e com relacionamentos de longo prazo",
    motivators: ["Segurança", "Harmonia", "Sinceridade", "Estabilidade", "Cooperação"],
  },
  C: {
    name: "Conformidade",
    color: "#3B82F6", // blue
    emoji: "🔬",
    shortDesc: "Analítico, Preciso, Metódico",
    description: "Pessoas com perfil C são analíticas, precisas e metódicas. Valorizam qualidade, exatidão e preferem trabalhar com dados e fatos antes de tomar decisões.",
    strengths: [
      "Atenção aos detalhes",
      "Pensamento analítico",
      "Alta qualidade do trabalho",
      "Organização",
      "Tomada de decisão baseada em dados",
    ],
    challenges: [
      "Perfeccionismo excessivo",
      "Análise paralisia",
      "Dificuldade com ambiguidade",
      "Crítico demais",
      "Dificuldade em delegar",
    ],
    communicationTips: [
      "Forneça dados e fatos",
      "Seja preciso e organizado",
      "Dê tempo para análise",
      "Evite pressão por decisões rápidas",
      "Respeite sua necessidade de qualidade",
    ],
    idealEnvironment: "Ambiente organizado com padrões claros e tempo para análise",
    motivators: ["Qualidade", "Exatidão", "Lógica", "Processos claros", "Especialização"],
  },
};

// Competências para Pesquisa 360°
export const assessment360Competencies = [
  {
    key: "leadership",
    name: "Liderança",
    description: "Capacidade de influenciar, motivar e guiar outras pessoas em direção aos objetivos",
    questions: [
      "Inspira confiança e respeito na equipe",
      "Define metas claras e alinhadas com a estratégia",
      "Desenvolve e capacita os membros da equipe",
      "Toma decisões de forma assertiva quando necessário",
      "Dá o exemplo através de suas próprias atitudes",
    ],
  },
  {
    key: "communication",
    name: "Comunicação",
    description: "Capacidade de transmitir informações de forma clara e efetiva",
    questions: [
      "Comunica-se de forma clara e objetiva",
      "Ouve atentamente antes de responder",
      "Adapta sua comunicação ao público",
      "Fornece feedback construtivo regularmente",
      "Mantém a equipe informada sobre mudanças importantes",
    ],
  },
  {
    key: "teamwork",
    name: "Trabalho em Equipe",
    description: "Capacidade de colaborar efetivamente com outros",
    questions: [
      "Colabora ativamente com os colegas",
      "Compartilha conhecimento e recursos",
      "Valoriza as contribuições dos outros",
      "Resolve diferenças de forma construtiva",
      "Contribui para um ambiente de trabalho positivo",
    ],
  },
  {
    key: "conflict_management",
    name: "Gestão de Conflitos",
    description: "Capacidade de lidar com divergências de forma construtiva",
    questions: [
      "Aborda conflitos de forma proativa",
      "Busca soluções ganha-ganha",
      "Mantém a calma em situações tensas",
      "Media disputas de forma imparcial",
      "Transforma conflitos em oportunidades de melhoria",
    ],
  },
  {
    key: "proactivity",
    name: "Proatividade",
    description: "Capacidade de antecipar problemas e agir sem precisar ser solicitado",
    questions: [
      "Antecipa problemas e age preventivamente",
      "Busca melhorias constantemente",
      "Toma iniciativa sem esperar ser mandado",
      "Propõe soluções criativas para desafios",
      "Assume responsabilidade além do esperado",
    ],
  },
  {
    key: "results_delivery",
    name: "Entrega de Resultados",
    description: "Capacidade de atingir metas e entregar valor",
    questions: [
      "Cumpre prazos consistentemente",
      "Entrega trabalho de alta qualidade",
      "Atinge ou supera as metas estabelecidas",
      "Mantém foco mesmo sob pressão",
      "Prioriza atividades de maior impacto",
    ],
  },
];
