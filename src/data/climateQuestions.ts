// Perguntas de Pesquisa de Clima Organizacional

export interface ClimateQuestion {
  id: string;
  section: string;
  question: string;
  type: 'scale_1_5' | 'scale_0_5' | 'boolean' | 'options' | 'text';
  options?: { value: string; label: string }[];
  required: boolean;
}

export const climateSections = [
  { id: 'satisfaction', name: 'Satisfação Geral', icon: '😊' },
  { id: 'superiors', name: 'Relacionamento com Superiores', icon: '👔' },
  { id: 'development', name: 'Desenvolvimento e Crescimento', icon: '📈' },
  { id: 'balance', name: 'Equilíbrio Vida Profissional/Pessoal', icon: '⚖️' },
  { id: 'recognition', name: 'Reconhecimento e Recompensas', icon: '🏆' },
  { id: 'environment', name: 'Ambiente de Trabalho', icon: '🏢' },
  { id: 'open', name: 'Feedback Geral', icon: '💬' },
];

export const climateQuestions: ClimateQuestion[] = [
  // Satisfação Geral
  {
    id: 'company_satisfaction',
    section: 'satisfaction',
    question: 'Em uma escala de 1 a 5, qual é o seu nível de satisfação com a empresa?',
    type: 'scale_1_5',
    required: true,
  },
  {
    id: 'organizational_culture',
    section: 'satisfaction',
    question: 'Como você avaliaria a cultura organizacional da empresa?',
    type: 'scale_0_5',
    required: true,
  },
  {
    id: 'feels_valued',
    section: 'satisfaction',
    question: 'Você sente que a empresa valoriza seu trabalho e contribuições?',
    type: 'options',
    options: [
      { value: 'very_much', label: 'Valoriza muito' },
      { value: 'not_enough', label: 'Valoriza mas não o suficiente' },
      { value: 'little', label: 'Valoriza pouco' },
      { value: 'not_at_all', label: 'Não valoriza nada' },
    ],
    required: true,
  },

  // Relacionamento com Superiores
  {
    id: 'communication_with_superiors',
    section: 'superiors',
    question: 'Como você avaliaria a comunicação entre você e seus superiores imediatos?',
    type: 'scale_0_5',
    required: true,
  },
  {
    id: 'superior_interest_development',
    section: 'superiors',
    question: 'Seu/sua superior imediato(a) demonstra interesse no seu desenvolvimento profissional?',
    type: 'scale_0_5',
    required: true,
  },
  {
    id: 'feels_supported',
    section: 'superiors',
    question: 'Você se sente apoiado(a) por seu/sua superior imediato(a) no cumprimento de suas tarefas e metas?',
    type: 'scale_0_5',
    required: true,
  },

  // Desenvolvimento e Crescimento
  {
    id: 'has_growth_opportunities',
    section: 'development',
    question: 'A empresa oferece oportunidades claras de crescimento profissional?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'receives_feedback',
    section: 'development',
    question: 'Você recebe feedback construtivo de seus superiores imediatos sobre seu desempenho?',
    type: 'options',
    options: [
      { value: 'frequently', label: 'Sim, com frequência' },
      { value: 'rarely', label: 'Sim, mas com pouca frequência' },
      { value: 'never', label: 'Não recebo feedback construtivo' },
    ],
    required: true,
  },
  {
    id: 'training_rating',
    section: 'development',
    question: 'Como você avaliaria os programas de treinamento e desenvolvimento oferecidos pela empresa?',
    type: 'scale_1_5',
    required: true,
  },

  // Equilíbrio Vida Profissional/Pessoal
  {
    id: 'company_values_balance',
    section: 'balance',
    question: 'Você sente que a empresa valoriza e promove um bom equilíbrio entre sua vida profissional e pessoal?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'company_offers_wellness',
    section: 'balance',
    question: 'A empresa oferece políticas e programas de bem-estar para os colaboradores?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'manages_responsibilities',
    section: 'balance',
    question: 'Você consegue gerenciar suas responsabilidades profissionais sem comprometer sua vida pessoal?',
    type: 'boolean',
    required: true,
  },

  // Reconhecimento e Recompensas
  {
    id: 'feels_valued_for_work',
    section: 'recognition',
    question: 'Você se sente valorizado(a) pela empresa pelo seu trabalho?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'adequate_recognition',
    section: 'recognition',
    question: 'A empresa oferece reconhecimento adequado por suas conquistas e desempenho?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'rewards_rating',
    section: 'recognition',
    question: 'Como você avaliaria o sistema de recompensas e benefícios da empresa?',
    type: 'scale_1_5',
    required: true,
  },

  // Ambiente de Trabalho
  {
    id: 'feels_comfortable_safe',
    section: 'environment',
    question: 'Você se sente confortável e seguro(a) no ambiente de trabalho?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'good_coworker_relationship',
    section: 'environment',
    question: 'Existe um bom relacionamento entre os colegas de trabalho?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'diversity_inclusion',
    section: 'environment',
    question: 'A empresa promove a diversidade e a inclusão no local de trabalho?',
    type: 'scale_1_5',
    required: true,
  },

  // Feedback Geral
  {
    id: 'what_company_does_well',
    section: 'open',
    question: 'De forma geral, nos diga tudo o que você acha que a empresa faz de bom para você colaborador',
    type: 'text',
    required: true,
  },
  {
    id: 'what_company_should_improve',
    section: 'open',
    question: 'De forma geral, diga tudo o que você acha que a empresa deve melhorar',
    type: 'text',
    required: true,
  },
  {
    id: 'enjoys_working_score',
    section: 'open',
    question: 'De 0 a 5, quanto você gosta de trabalhar na empresa?',
    type: 'scale_0_5',
    required: true,
  },
  {
    id: 'would_recommend_score',
    section: 'open',
    question: 'De 0 a 5, quanto você indicaria um amigo para trabalhar na sua empresa?',
    type: 'scale_0_5',
    required: true,
  },
  {
    id: 'open_feedback',
    section: 'open',
    question: 'Espaço reservado para você falar tudo o que gostaria de falar sobre a empresa. Pode desabafar à vontade.',
    type: 'text',
    required: true,
  },
];

export const getQuestionsBySection = (sectionId: string) => {
  return climateQuestions.filter(q => q.section === sectionId);
};
